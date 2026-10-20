"""
Scheduler de Notificações de Contas Vencidas
Verifica diariamente contas para enviar notificações automáticas
(WhatsApp e/ou FCM push no app).
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from motor.motor_asyncio import AsyncIOMotorDatabase

from models.notification_history import NotificationType
from services.fcm_notification import FcmNotificationService
from services.notification_lock import NotificationLock
from services.whatsapp_notification import WhatsAppNotificationService
from utils.formatting import normalize_phone_for_whatsapp

logger = logging.getLogger(__name__)

BRT = ZoneInfo("America/Sao_Paulo")


def _expense_calendar_date(dt: datetime):
    """
    Dia civil do vencimento como no formulário (YYYY-MM-DD).
    Não converte meia-noite UTC → véspera em Brasília.
    """
    if dt.tzinfo is None:
        return dt.date()
    return dt.astimezone(UTC).date()


class NotificationScheduler:
    """Scheduler para verificar e enviar notificações de contas vencidas"""

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        whatsapp_service: Optional[WhatsAppNotificationService] = None,
        fcm_service: Optional[FcmNotificationService] = None,
    ):
        self.db = db
        self.whatsapp = whatsapp_service
        self.fcm = fcm_service or FcmNotificationService()
        self.logger = logger
        self._stats: dict = {}

    def _reset_stats(self) -> dict:
        self._stats = {
            "skipped_lock": False,
            "users_processed": 0,
            "whatsapp_sent": 0,
            "whatsapp_failed": 0,
            "whatsapp_skipped": 0,
            "fcm_sent": 0,
            "fcm_failed": 0,
            "fcm_skipped": 0,
        }
        return self._stats

    async def check_and_send_notifications(self) -> dict:
        """
        Verifica todas as contas e envia notificações necessárias
        Com proteção de lock para evitar duplicação em múltiplas instâncias
        """
        stats = self._reset_stats()
        lock = NotificationLock(self.db)

        if not await lock.acquire_lock():
            self.logger.info(
                "⏳ Aguardando próximo ciclo (outro processo ainda está enviando)"
            )
            stats["skipped_lock"] = True
            return stats

        try:
            self.logger.info("🔍 Iniciando verificação de contas para notificações...")

            try:
                whatsapp_settings = await self.db.system_settings.find_one(
                    {"_id": "whatsapp"}
                )
                whatsapp_global_on = not (
                    whatsapp_settings
                    and whatsapp_settings.get("service_enabled", True) is False
                )
                if not whatsapp_global_on:
                    self.logger.info(
                        "⏸️  WhatsApp desabilitado globalmente — FCM segue ativo se houver tokens"
                    )

                # Falha na subida do processo não desliga o WhatsApp para sempre.
                whatsapp_up = (
                    await self._ensure_whatsapp() if whatsapp_global_on else False
                )

                users = await self.db.users.find({"is_active": True}).to_list(None)
                self.logger.info(f"📊 Processando {len(users)} usuários")

                for user in users:
                    user_id = str(user.get("_id"))
                    user_name = user.get("full_name", "Usuário desconhecido")
                    phone_raw = user.get("phone")

                    wa_user_on = (
                        user.get("whatsapp_notifications_enabled", True) is not False
                    )
                    phone_normalized = None
                    if (
                        whatsapp_global_on
                        and wa_user_on
                        and phone_raw
                        and whatsapp_up
                    ):
                        phone_normalized = normalize_phone_for_whatsapp(phone_raw)
                        if not phone_normalized:
                            self.logger.warning(
                                f"⚠️  Telefone inválido para {user_name}"
                            )

                    token_docs = await self.db.device_tokens.find(
                        {"user_id": user_id, "active": True}
                    ).to_list(None)
                    fcm_tokens = [
                        t["token"] for t in token_docs if t.get("token")
                    ]

                    if not phone_normalized and not fcm_tokens:
                        self.logger.debug(
                            f"⏭️  {user_name}: sem WhatsApp e sem token FCM"
                        )
                        continue

                    stats["users_processed"] += 1
                    await self._check_expenses(
                        user_id, user_name, phone_normalized, fcm_tokens
                    )
                    await self._check_debts(
                        user_id, user_name, phone_normalized, fcm_tokens
                    )

                self.logger.info("✅ Verificação de notificações concluída")

            except Exception as e:
                self.logger.error(
                    f"❌ Erro ao verificar notificações: {e}", exc_info=True
                )
                stats["error"] = str(e)

        finally:
            await lock.release_lock()

        return stats

    async def _ensure_whatsapp(self) -> bool:
        """
        Garante um cliente WAHA para este ciclo.
        Se o probe da subida falhou, o cliente pode estar ausente: recria e testa de novo.
        Uma falha aqui vale só para este ciclo; a próxima execução tenta outra vez.
        """
        if self.whatsapp is None:
            from services.whatsapp_notification import build_whatsapp_service

            self.whatsapp = build_whatsapp_service()
        if self.whatsapp is None:
            return False
        try:
            ok, message = await asyncio.to_thread(self.whatsapp.test_connection)
        except Exception as exc:
            self.logger.warning("⏸️  WAHA indisponível neste ciclo: %s", exc)
            return False
        if not ok:
            self.logger.warning(
                "⏸️  WAHA indisponível neste ciclo — nova tentativa no próximo: %s",
                message,
            )
            return False
        return True

    async def _check_expenses(
        self,
        user_id: str,
        user_name: str,
        phone: Optional[str],
        fcm_tokens: Optional[list[str]] = None,
    ):
        try:
            today_brt = datetime.now(BRT).date()
            expenses = await self.db.expenses.find(
                {"user_id": user_id, "status": {"$in": ["EM ABERTO", "NÃO PAGO"]}}
            ).to_list(None)

            for expense in expenses:
                expense_id = str(expense.get("_id"))
                due_date = expense.get("due_date")
                description = expense.get("description", "Despesa")
                amount = expense.get("amount", 0)

                if not due_date:
                    continue

                if isinstance(due_date, str):
                    due_date = datetime.fromisoformat(due_date.replace("Z", "+00:00"))

                if due_date.tzinfo is None:
                    due_date = due_date.replace(tzinfo=UTC)

                days_diff = (_expense_calendar_date(due_date) - today_brt).days

                if days_diff == 5:
                    await self._send_if_not_sent(
                        user_id,
                        expense_id,
                        "expense",
                        NotificationType.EXPENSE_5_DAYS_BEFORE,
                        phone,
                        user_name,
                        description,
                        amount,
                        due_date,
                        fcm_tokens=fcm_tokens,
                    )
                elif days_diff == 1:
                    await self._send_if_not_sent(
                        user_id,
                        expense_id,
                        "expense",
                        NotificationType.EXPENSE_1_DAY_BEFORE,
                        phone,
                        user_name,
                        description,
                        amount,
                        due_date,
                        fcm_tokens=fcm_tokens,
                    )
                elif days_diff <= 0 and days_diff >= -30:
                    await self._send_if_not_sent(
                        user_id,
                        expense_id,
                        "expense",
                        NotificationType.EXPENSE_OVERDUE,
                        phone,
                        user_name,
                        description,
                        amount,
                        due_date,
                        days_overdue=abs(days_diff),
                        fcm_tokens=fcm_tokens,
                    )

        except Exception as e:
            self.logger.error(
                f"❌ Erro ao verificar despesas para {user_id}: {e}", exc_info=True
            )

    async def _check_debts(
        self,
        user_id: str,
        user_name: str,
        phone: Optional[str],
        fcm_tokens: Optional[list[str]] = None,
    ):
        try:
            from calendar import monthrange

            today = datetime.now(BRT).date()

            debts = await self.db.debts.find(
                {"user_id": user_id, "status": "ACTIVE"}
            ).to_list(None)

            for debt in debts:
                debt_id = str(debt.get("_id"))
                due_day = debt.get("due_day")
                name = debt.get("name", "Dívida")
                current_balance = debt.get("current_balance", 0)

                if not due_day:
                    continue

                try:
                    due_day_int = int(due_day)
                except (TypeError, ValueError):
                    continue
                if due_day_int < 1 or due_day_int > 31:
                    continue

                # Sempre usa o vencimento do mês corrente.
                # (Antes, dia já passado ia para o mês seguinte e nunca gerava atraso.)
                last_day = monthrange(today.year, today.month)[1]
                vencimento = today.replace(day=min(due_day_int, last_day))

                vencimento_dt = datetime.combine(
                    vencimento, datetime.min.time(), tzinfo=BRT
                )
                days_diff = (vencimento - today).days

                if days_diff == 5:
                    await self._send_if_not_sent(
                        user_id,
                        debt_id,
                        "debt",
                        NotificationType.DEBT_5_DAYS_BEFORE,
                        phone,
                        user_name,
                        name,
                        current_balance,
                        vencimento_dt,
                        fcm_tokens=fcm_tokens,
                    )
                elif days_diff == 1:
                    await self._send_if_not_sent(
                        user_id,
                        debt_id,
                        "debt",
                        NotificationType.DEBT_1_DAY_BEFORE,
                        phone,
                        user_name,
                        name,
                        current_balance,
                        vencimento_dt,
                        fcm_tokens=fcm_tokens,
                    )
                elif days_diff <= 0 and days_diff >= -30:
                    await self._send_if_not_sent(
                        user_id,
                        debt_id,
                        "debt",
                        NotificationType.DEBT_OVERDUE,
                        phone,
                        user_name,
                        name,
                        current_balance,
                        vencimento_dt,
                        days_overdue=abs(days_diff),
                        fcm_tokens=fcm_tokens,
                    )

        except Exception as e:
            self.logger.error(
                f"❌ Erro ao verificar dívidas para {user_id}: {e}", exc_info=True
            )

    async def _already_sent(
        self, user_id: str, item_id: str, notification_type: str, channel: str
    ) -> bool:
        query: dict = {
            "user_id": user_id,
            "related_item_id": item_id,
            "notification_type": notification_type,
            "status": "SENT",
        }

        if channel == "whatsapp":
            # Docs antigos sem channel = WhatsApp
            query["$or"] = [
                {"channel": "whatsapp"},
                {"channel": {"$exists": False}},
            ]
        else:
            query["channel"] = channel

        # Atraso: reenvia 1× por dia com "dias em atraso" atualizado
        # (antes só ia uma vez — ex.: no dia do vencimento — e nunca mais)
        if "OVERDUE" in notification_type:
            today_brt = datetime.now(BRT).date()
            start = datetime.combine(
                today_brt, datetime.min.time(), tzinfo=BRT
            ).astimezone(UTC)
            end = datetime.combine(
                today_brt, datetime.max.time(), tzinfo=BRT
            ).astimezone(UTC)
            query["created_at"] = {"$gte": start, "$lte": end}

        existing = await self.db.notification_history.find_one(query)
        return existing is not None

    async def _send_if_not_sent(
        self,
        user_id: str,
        item_id: str,
        item_type: str,
        notification_type: NotificationType,
        phone: Optional[str],
        user_name: str,
        description: str,
        amount: float,
        due_date: datetime,
        days_overdue: int = 0,
        fcm_tokens: Optional[list[str]] = None,
    ):
        """Envia WhatsApp e/ou FCM se ainda não enviados neste canal."""
        try:
            fcm_tokens = fcm_tokens or []
            ntype = notification_type.value

            # --- WhatsApp ---
            if phone and self.whatsapp:
                if not await self._already_sent(user_id, item_id, ntype, "whatsapp"):
                    phone_clean = "".join(c for c in phone if c.isdigit())
                    if not phone_clean.startswith("55"):
                        phone_clean = "55" + phone_clean

                    success, message = await self._send_notification(
                        phone_clean,
                        user_name,
                        description,
                        amount,
                        due_date,
                        notification_type,
                        days_overdue,
                    )

                    await self.db.notification_history.insert_one(
                        {
                            "user_id": user_id,
                            "notification_type": ntype,
                            "related_item_id": item_id,
                            "related_item_type": item_type,
                            "item_description": description,
                            "amount": amount,
                            "due_date": due_date,
                            "channel": "whatsapp",
                            "whatsapp_number": phone_clean,
                            "message_text": message,
                            "status": "SENT" if success else "FAILED",
                            "error_message": None if success else message,
                            "sent_at": datetime.now(UTC) if success else None,
                            "created_at": datetime.now(UTC),
                        }
                    )
                    if success:
                        self._stats["whatsapp_sent"] = (
                            self._stats.get("whatsapp_sent", 0) + 1
                        )
                        self.logger.info(f"✅ WhatsApp enviado para {phone_clean}")
                    else:
                        self._stats["whatsapp_failed"] = (
                            self._stats.get("whatsapp_failed", 0) + 1
                        )
                        self.logger.warning(f"⚠️  WhatsApp falhou: {message}")
                else:
                    self._stats["whatsapp_skipped"] = (
                        self._stats.get("whatsapp_skipped", 0) + 1
                    )
                    self.logger.debug(
                        f"⏭️  WhatsApp já enviado para {item_type} {item_id}"
                    )

            # --- FCM (app fechado) ---
            if fcm_tokens and self.fcm and self.fcm.is_ready():
                if not await self._already_sent(user_id, item_id, ntype, "fcm"):
                    title, body = self.fcm.build_message(
                        user_name,
                        description,
                        amount,
                        due_date,
                        ntype,
                        days_overdue,
                    )
                    success, message, dead_tokens = await asyncio.to_thread(
                        self.fcm.send_to_tokens,
                        fcm_tokens,
                        title,
                        body,
                        {
                            "item_id": item_id,
                            "item_type": item_type,
                            "notification_type": ntype,
                        },
                    )
                    if dead_tokens:
                        await self.db.device_tokens.update_many(
                            {"token": {"$in": dead_tokens}, "user_id": user_id},
                            {
                                "$set": {
                                    "active": False,
                                    "updated_at": datetime.now(UTC),
                                    "inactive_reason": "fcm_unregistered",
                                }
                            },
                        )
                        self.logger.info(
                            f"🧹 {len(dead_tokens)} token(s) FCM desativados "
                            f"para user {user_id}"
                        )
                    await self.db.notification_history.insert_one(
                        {
                            "user_id": user_id,
                            "notification_type": ntype,
                            "related_item_id": item_id,
                            "related_item_type": item_type,
                            "item_description": description,
                            "amount": amount,
                            "due_date": due_date,
                            "channel": "fcm",
                            "message_text": f"{title}: {body}",
                            "status": "SENT" if success else "FAILED",
                            "error_message": None if success else message,
                            "sent_at": datetime.now(UTC) if success else None,
                            "created_at": datetime.now(UTC),
                        }
                    )
                    if success:
                        self._stats["fcm_sent"] = self._stats.get("fcm_sent", 0) + 1
                        self.logger.info(f"✅ FCM enviado para user {user_id}")
                    else:
                        self._stats["fcm_failed"] = self._stats.get("fcm_failed", 0) + 1
                        self.logger.warning(f"⚠️  FCM falhou: {message}")
                else:
                    self._stats["fcm_skipped"] = self._stats.get("fcm_skipped", 0) + 1
                    self.logger.debug(
                        f"⏭️  FCM já enviado para {item_type} {item_id}"
                    )

        except Exception as e:
            self.logger.error(f"❌ Erro ao enviar notificação: {e}", exc_info=True)

    async def _send_notification(
        self,
        phone: str,
        user_name: str,
        description: str,
        amount: float,
        due_date: datetime,
        notification_type: NotificationType,
        days_overdue: int = 0,
    ) -> tuple:
        if not self.whatsapp:
            return False, "whatsapp_nao_configurado"

        if notification_type == NotificationType.EXPENSE_5_DAYS_BEFORE:
            return self.whatsapp.send_notification_expense_5_days_before(
                phone, user_name, description, amount, due_date
            )
        elif notification_type == NotificationType.EXPENSE_1_DAY_BEFORE:
            return self.whatsapp.send_notification_expense_1_day_before(
                phone, user_name, description, amount, due_date
            )
        elif notification_type == NotificationType.EXPENSE_OVERDUE:
            return self.whatsapp.send_notification_expense_overdue(
                phone, user_name, description, amount, due_date, days_overdue
            )
        elif notification_type == NotificationType.DEBT_5_DAYS_BEFORE:
            return self.whatsapp.send_notification_debt_5_days_before(
                phone, user_name, description, amount, due_date
            )
        elif notification_type == NotificationType.DEBT_1_DAY_BEFORE:
            return self.whatsapp.send_notification_debt_1_day_before(
                phone, user_name, description, amount, due_date
            )
        elif notification_type == NotificationType.DEBT_OVERDUE:
            return self.whatsapp.send_notification_debt_overdue(
                phone, user_name, description, amount, due_date, days_overdue
            )

        return False, "Tipo de notificação desconhecido"
