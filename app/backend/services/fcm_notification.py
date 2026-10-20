"""
Serviço Firebase Cloud Messaging (FCM) — push nativo no app.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_firebase_ready = False


def _init_firebase() -> bool:
    global _firebase_ready
    if _firebase_ready:
        return True

    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        logger.warning("firebase-admin não instalado — FCM desabilitado")
        return False

    if firebase_admin._apps:
        _firebase_ready = True
        return True

    cred_path = os.getenv("FCM_CREDENTIALS_FILE") or os.getenv(
        "GOOGLE_APPLICATION_CREDENTIALS"
    )
    cred_json = os.getenv("FCM_CREDENTIALS_JSON")

    # Fallback para Settings pydantic
    if not cred_path and not cred_json:
        try:
            from config import settings

            cred_path = getattr(settings, "fcm_credentials_file", None) or cred_path
            cred_json = getattr(settings, "fcm_credentials_json", None) or cred_json
        except Exception:
            pass

    try:
        if cred_json:
            info = json.loads(cred_json)
            cred = credentials.Certificate(info)
        elif cred_path and Path(cred_path).is_file():
            cred = credentials.Certificate(cred_path)
        else:
            logger.info(
                "FCM sem credenciais (defina FCM_CREDENTIALS_FILE ou FCM_CREDENTIALS_JSON)"
            )
            return False

        firebase_admin.initialize_app(cred)
        _firebase_ready = True
        logger.info("✅ Firebase Admin inicializado (FCM)")
        return True
    except Exception as e:
        logger.error(f"Falha ao iniciar Firebase Admin: {e}", exc_info=True)
        return False


def fcm_is_configured() -> bool:
    return _init_firebase()


class FcmNotificationService:
    """Envia push para tokens FCM registrados no app."""

    def is_ready(self) -> bool:
        return fcm_is_configured()

    def build_message(
        self,
        user_name: str,
        description: str,
        amount: float,
        due_date: datetime,
        notification_type: str,
        days_overdue: int = 0,
    ) -> tuple[str, str]:
        money = f"R$ {amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        due_str = due_date.strftime("%d/%m/%Y") if due_date else ""

        if "5_DAYS" in notification_type or "5_days" in notification_type.lower():
            title = "Controle de Contas"
            body = f"Lembrete: {description} vence em 5 dias ({due_str}) — {money}"
        elif "1_DAY" in notification_type or "1_day" in notification_type.lower():
            title = "Controle de Contas"
            body = f"Atenção: {description} vence amanhã ({due_str}) — {money}"
        elif "OVERDUE" in notification_type or "overdue" in notification_type.lower():
            title = "Controle de Contas"
            if days_overdue <= 0:
                body = f"Vence HOJE: {description} — {money}"
            else:
                body = (
                    f"Fatura atrasada: {description} — {money} "
                    f"(há {days_overdue} dia(s))"
                )
        else:
            title = "Controle de Contas"
            body = f"{description} — {money}"

        return title, body

    @staticmethod
    def _android_tag(data: Optional[dict]) -> Optional[str]:
        """Tag estável por conta+tipo → Android substitui em vez de empilhar."""
        if not data:
            return None
        item_id = data.get("item_id")
        ntype = data.get("notification_type")
        if not item_id or not ntype:
            return None
        item_type = data.get("item_type") or "item"
        # Android tag max ~64 chars; ObjectId = 24
        return f"cc_{item_type}_{item_id}_{ntype}"[:64]

    def send_to_tokens(
        self,
        tokens: list[str],
        title: str,
        body: str,
        data: Optional[dict] = None,
    ) -> tuple[bool, str, list[str]]:
        """
        Envia push. Retorna (ok, detalhe, tokens_invalidos).
        tokens_invalidos devem ser desativados no banco.
        """
        if not tokens:
            return False, "sem_tokens", []
        if not self.is_ready():
            return False, "fcm_nao_configurado", []

        try:
            from firebase_admin import messaging
        except ImportError:
            return False, "firebase_admin_ausente", []

        # Dedup na lista (mesmo token várias vezes no cursor)
        unique_tokens = list(dict.fromkeys(t for t in tokens if t))

        ok = 0
        errors = []
        dead_tokens: list[str] = []
        payload_data = {k: str(v) for k, v in (data or {}).items()}
        tag = self._android_tag(data)
        collapse_key = tag or "contas"

        for token in unique_tokens:
            try:
                android_notif = messaging.AndroidNotification(
                    channel_id="contas",
                    priority="high",
                    default_sound=True,
                    tag=tag,
                    icon="ic_stat_contas",
                    color="#0D9488",
                )
                msg = messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    data=payload_data,
                    token=token,
                    android=messaging.AndroidConfig(
                        priority="high",
                        collapse_key=collapse_key,
                        notification=android_notif,
                    ),
                )
                messaging.send(msg)
                ok += 1
            except Exception as e:
                err = str(e)
                errors.append(err)
                logger.warning(f"FCM falhou para token …{token[-8:]}: {e}")
                if self._is_dead_token_error(e):
                    dead_tokens.append(token)

        if ok:
            return True, f"enviado_{ok}", dead_tokens
        return False, "; ".join(errors)[:500] or "falha_fcm", dead_tokens

    @staticmethod
    def _is_dead_token_error(exc: Exception) -> bool:
        try:
            from firebase_admin import messaging

            dead_types: list[type] = [messaging.UnregisteredError]
            sender_mismatch = getattr(messaging, "SenderIdMismatchError", None)
            if isinstance(sender_mismatch, type):
                dead_types.append(sender_mismatch)
            if isinstance(exc, tuple(dead_types)):
                return True
        except Exception:
            pass
        text = str(exc).lower()
        return any(
            s in text
            for s in (
                "unregistered",
                "notregistered",
                "registration-token-not-registered",
                "requested entity was not found",
                "invalidregistration",
            )
        )
