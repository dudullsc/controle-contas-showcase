"""
Testes do fluxo WhatsApp / WAHA — evita regressões como session errada.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest


class TestNormalizePhoneForWhatsApp:
    def test_adds_country_code(self):
        from utils.formatting import normalize_phone_for_whatsapp

        assert normalize_phone_for_whatsapp("48984464815") == "5548984464815"
        assert normalize_phone_for_whatsapp("(48) 98446-4815") == "5548984464815"

    def test_keeps_existing_country_code(self):
        from utils.formatting import normalize_phone_for_whatsapp

        assert normalize_phone_for_whatsapp("5548984464815") == "5548984464815"

    def test_rejects_invalid(self):
        from utils.formatting import normalize_phone_for_whatsapp

        assert normalize_phone_for_whatsapp(None) is None
        assert normalize_phone_for_whatsapp("") is None
        assert normalize_phone_for_whatsapp("123") is None


class TestWhatsAppNotificationService:
    def test_default_session_is_default(self):
        from services.whatsapp_notification import WhatsAppNotificationService

        service = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session=None
        )
        assert service.session == "default"

    def test_explicit_session_is_used(self):
        from services.whatsapp_notification import WhatsAppNotificationService

        service = WhatsAppNotificationService(
            base_url="http://waha:3000",
            api_key="k",
            session="session_01kz57jxx8bc1t0dqwyq3vtytr",
        )
        assert service.session == "session_01kz57jxx8bc1t0dqwyq3vtytr"

    def test_send_text_includes_session_in_payload(self):
        from services.whatsapp_notification import WhatsAppNotificationService

        service = WhatsAppNotificationService(
            base_url="http://waha:3000",
            api_key="test-api-key",
            session="default",
        )

        mock_response = MagicMock(status_code=200, text="ok")

        with patch(
            "services.whatsapp_notification.requests.post", return_value=mock_response
        ) as mock_post:
            ok, msg = service.send_text_message("5548984464815", "olá")

        assert ok is True
        assert "sucesso" in msg.lower()
        payload = mock_post.call_args.kwargs["json"]
        assert payload["session"] == "default"
        assert payload["chatId"] == "5548984464815@c.us"
        assert payload["text"] == "olá"
        assert mock_post.call_args.kwargs["headers"]["X-Api-Key"] == "test-api-key"
        assert mock_post.call_args.args[0] == "http://waha:3000/api/sendText"

    def test_send_text_uses_custom_session_name(self):
        from services.whatsapp_notification import WhatsAppNotificationService

        service = WhatsAppNotificationService(
            base_url="http://waha:3000",
            api_key="k",
            session="session_custom",
        )
        mock_response = MagicMock(status_code=201, text="ok")

        with patch(
            "services.whatsapp_notification.requests.post", return_value=mock_response
        ) as mock_post:
            ok, _ = service.send_text_message("5548999999999", "teste")

        assert ok is True
        assert mock_post.call_args.kwargs["json"]["session"] == "session_custom"

    def test_send_text_without_api_key(self):
        from services.whatsapp_notification import WhatsAppNotificationService

        service = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="placeholder", session="default"
        )
        service.api_key = None
        ok, msg = service.send_text_message("5548999999999", "x")
        assert ok is False
        assert "API Key" in msg

    def test_send_text_http_error(self):
        from services.whatsapp_notification import WhatsAppNotificationService

        service = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )
        mock_response = MagicMock(status_code=422, text="Session status is not WORKING")

        with patch(
            "services.whatsapp_notification.requests.post", return_value=mock_response
        ):
            ok, msg = service.send_text_message("5548999999999", "x")

        assert ok is False
        assert "Erro" in msg

    def test_connection_success(self):
        from services.whatsapp_notification import WhatsAppNotificationService

        service = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )
        mock_response = MagicMock(status_code=200)
        mock_response.json.return_value = [{"name": "default", "status": "WORKING"}]

        with patch(
            "services.whatsapp_notification.requests.get", return_value=mock_response
        ) as mock_get:
            ok, msg = service.test_connection()

        assert ok is True
        assert mock_get.call_args.args[0] == "http://waha:3000/api/sessions"
        assert "Conectado" in msg or "sucesso" in msg.lower()

    def test_connection_rejects_session_stuck_starting(self):
        from services.whatsapp_notification import WhatsAppNotificationService

        service = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )
        mock_response = MagicMock(status_code=200)
        mock_response.json.return_value = [{"name": "default", "status": "STARTING"}]

        with patch(
            "services.whatsapp_notification.requests.get", return_value=mock_response
        ):
            ok, msg = service.test_connection()

        assert ok is False
        assert "STARTING" in msg
        assert "WORKING" in msg

    def test_connection_unauthorized(self):
        from services.whatsapp_notification import WhatsAppNotificationService

        service = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="bad", session="default"
        )
        mock_response = MagicMock(status_code=401)

        with patch(
            "services.whatsapp_notification.requests.get", return_value=mock_response
        ):
            ok, msg = service.test_connection()

        assert ok is False
        assert "API Key" in msg or "inválida" in msg.lower()

    def test_expense_overdue_message_calls_send_text(self):
        from services.whatsapp_notification import WhatsAppNotificationService

        service = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )

        with patch.object(
            service, "send_text_message", return_value=(True, "ok")
        ) as mock_send:
            ok, _ = service.send_notification_expense_overdue(
                phone_number="5548999999999",
                user_name="Eduardo",
                expense_description="Nubank",
                amount=100.5,
                due_date=datetime(2026, 8, 1, tzinfo=UTC),
                days_overdue=3,
            )

        assert ok is True
        phone, text = mock_send.call_args.args
        assert phone == "5548999999999"
        assert "Eduardo" in text
        assert "Nubank" in text


class TestWahaSessionSettings:
    def test_waha_session_from_env(self, monkeypatch):
        monkeypatch.setenv("MONGODB_URL", "mongodb://localhost:27017")
        monkeypatch.setenv("SECRET_KEY", "test-secret")
        monkeypatch.setenv("WAHA_SESSION", "default")

        from config import Settings

        assert Settings().waha_session == "default"

    def test_waha_session_custom_from_env(self, monkeypatch):
        monkeypatch.setenv("MONGODB_URL", "mongodb://localhost:27017")
        monkeypatch.setenv("SECRET_KEY", "test-secret")
        monkeypatch.setenv("WAHA_SESSION", "session_01abc")

        from config import Settings

        assert Settings().waha_session == "session_01abc"


class TestNotificationTestSendEndpoint:
    def test_test_send_requires_auth(self, client):
        response = client.post("/api/notifications/test-send/48984464815")
        assert response.status_code in (401, 403)

    def test_run_requires_auth(self, client):
        response = client.post("/api/notifications/run")
        assert response.status_code in (401, 403)

    def test_run_requires_super_admin(self, client):
        from main import app
        from models.user import User, UserRole
        from utils.deps import get_current_active_user, get_current_super_admin

        user = User(
            _id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            full_name="Admin",
            role=UserRole.USERADMIN.value,
            created_at=datetime.now(UTC),
            is_active=True,
        )

        app.dependency_overrides[get_current_active_user] = lambda: user

        async def deny_super():
            from fastapi import HTTPException

            raise HTTPException(status_code=403, detail="Superadmin required")

        app.dependency_overrides[get_current_super_admin] = deny_super
        try:
            response = client.post("/api/notifications/run")
            assert response.status_code == 403
        finally:
            app.dependency_overrides.clear()

    def test_test_send_uses_configured_session(self, client):
        import config as config_module
        from main import app
        from models.user import User
        from utils.deps import get_current_active_user

        user = User(
            _id="507f1f77bcf86cd799439011",
            email="edu@example.com",
            full_name="Eduardo",
            created_at=datetime.now(UTC),
            is_active=True,
        )

        app.dependency_overrides[get_current_active_user] = lambda: user
        try:
            with (
                patch.object(config_module.settings, "waha_api_key", "test-key"),
                patch.object(
                    config_module.settings, "waha_base_url", "http://waha:3000"
                ),
                patch.object(config_module.settings, "waha_session", "default"),
                patch(
                    "services.whatsapp_notification.WhatsAppNotificationService"
                ) as MockSvc,
            ):
                instance = MockSvc.return_value
                instance.send_text_message.return_value = (True, "Mensagem enviada")

                response = client.post("/api/notifications/test-send/48984464815")

            assert response.status_code == 200
            body = response.json()
            assert body["success"] is True
            assert body["phone"] == "5548984464815"
            assert MockSvc.call_args.kwargs["session"] == "default"
            assert MockSvc.call_args.kwargs["base_url"] == "http://waha:3000"
        finally:
            app.dependency_overrides.clear()

    def test_test_send_rejects_invalid_phone(self, client):
        import config as config_module
        from main import app
        from models.user import User
        from utils.deps import get_current_active_user

        user = User(
            _id="507f1f77bcf86cd799439011",
            email="edu@example.com",
            full_name="Eduardo",
            created_at=datetime.now(UTC),
            is_active=True,
        )
        app.dependency_overrides[get_current_active_user] = lambda: user
        try:
            with patch.object(config_module.settings, "waha_api_key", "test-key"):
                response = client.post("/api/notifications/test-send/123")
            assert response.status_code == 400
            assert "inválido" in response.text.lower()
        finally:
            app.dependency_overrides.clear()


@pytest.mark.asyncio
class TestNotificationSchedulerSession:
    async def test_scheduler_sends_via_service_session(self):
        from models.notification_history import NotificationType
        from services.notification_scheduler import NotificationScheduler
        from services.whatsapp_notification import WhatsAppNotificationService

        whatsapp = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )
        db = MagicMock()
        db.notification_history.find_one = AsyncMock(return_value=None)
        db.notification_history.insert_one = AsyncMock()

        scheduler = NotificationScheduler(db, whatsapp)

        with patch.object(
            whatsapp, "send_notification_expense_overdue", return_value=(True, "ok")
        ) as mock_send:
            await scheduler._send_if_not_sent(
                user_id="u1",
                item_id="e1",
                item_type="expense",
                notification_type=NotificationType.EXPENSE_OVERDUE,
                phone="5548999999999",
                user_name="Edu",
                description="Conta",
                amount=50.0,
                due_date=datetime(2026, 8, 1, tzinfo=UTC),
                days_overdue=2,
            )

        mock_send.assert_called_once()
        assert whatsapp.session == "default"
        inserted = db.notification_history.insert_one.await_args.args[0]
        assert inserted["status"] == "SENT"
        assert inserted["whatsapp_number"] == "5548999999999"

    async def test_scheduler_skips_already_sent(self):
        from models.notification_history import NotificationType
        from services.notification_scheduler import NotificationScheduler
        from services.whatsapp_notification import WhatsAppNotificationService

        whatsapp = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )
        db = MagicMock()
        db.notification_history.find_one = AsyncMock(return_value={"_id": "exists"})
        db.notification_history.insert_one = AsyncMock()

        scheduler = NotificationScheduler(db, whatsapp)

        with patch.object(whatsapp, "send_notification_expense_overdue") as mock_send:
            await scheduler._send_if_not_sent(
                user_id="u1",
                item_id="e1",
                item_type="expense",
                notification_type=NotificationType.EXPENSE_OVERDUE,
                phone="5548999999999",
                user_name="Edu",
                description="Conta",
                amount=50.0,
                due_date=datetime(2026, 8, 1, tzinfo=UTC),
                days_overdue=2,
            )

        mock_send.assert_not_called()
        db.notification_history.insert_one.assert_not_called()
        # OVERDUE filtra por created_at do dia (BRT) para reenviar nos próximos dias
        find_query = db.notification_history.find_one.await_args.args[0]
        assert "created_at" in find_query
        assert "$gte" in find_query["created_at"]

    async def test_scheduler_overdue_resent_next_day(self):
        """Se não houve envio HOJE, reenvia atraso mesmo já tendo enviado ontem."""
        from models.notification_history import NotificationType
        from services.notification_scheduler import NotificationScheduler
        from services.whatsapp_notification import WhatsAppNotificationService

        whatsapp = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )
        db = MagicMock()
        # Sem registro de hoje → find_one retorna None
        db.notification_history.find_one = AsyncMock(return_value=None)
        db.notification_history.insert_one = AsyncMock()

        scheduler = NotificationScheduler(db, whatsapp)

        with patch.object(
            whatsapp, "send_notification_expense_overdue", return_value=(True, "ok")
        ) as mock_send:
            await scheduler._send_if_not_sent(
                user_id="u1",
                item_id="e1",
                item_type="expense",
                notification_type=NotificationType.EXPENSE_OVERDUE,
                phone="5548999999999",
                user_name="Edu",
                description="Conta",
                amount=50.0,
                due_date=datetime(2026, 8, 1, tzinfo=UTC),
                days_overdue=5,
            )

        mock_send.assert_called_once()
        assert mock_send.call_args.kwargs.get("days_overdue") == 5 or (
            mock_send.call_args.args and mock_send.call_args.args[-1] == 5
        )

    async def test_check_debts_marks_past_due_day_as_overdue(self):
        """Dia de vencimento já passado no mês atual deve gerar DEBT_OVERDUE."""
        from models.notification_history import NotificationType
        from services.notification_scheduler import NotificationScheduler

        db = MagicMock()
        debts_cursor = MagicMock()
        debts_cursor.to_list = AsyncMock(
            return_value=[
                {
                    "_id": "d1",
                    "name": "Cartão",
                    "due_day": 10,
                    "current_balance": 100.0,
                    "status": "ACTIVE",
                }
            ]
        )
        db.debts.find = MagicMock(return_value=debts_cursor)

        scheduler = NotificationScheduler(db, None)
        fixed_now = datetime(2026, 9, 16, 12, 0, tzinfo=ZoneInfo("America/Sao_Paulo"))
        with (
            patch("services.notification_scheduler.datetime") as mock_dt,
            patch.object(
                scheduler, "_send_if_not_sent", new_callable=AsyncMock
            ) as mock_send,
        ):
            mock_dt.now.return_value = fixed_now
            mock_dt.combine = datetime.combine
            mock_dt.min = datetime.min

            await scheduler._check_debts("u1", "Edu", "5548999999999", [])

        mock_send.assert_called_once()
        assert mock_send.call_args.args[3] == NotificationType.DEBT_OVERDUE
        assert mock_send.call_args.kwargs.get("days_overdue") == 6

    async def test_scheduler_skips_when_service_disabled_globally(self):
        """WhatsApp global off: ainda processa usuários (FCM), sem telefone WA."""
        from services.notification_scheduler import NotificationScheduler
        from services.whatsapp_notification import WhatsAppNotificationService

        whatsapp = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )

        users_cursor = MagicMock()
        users_cursor.to_list = AsyncMock(
            return_value=[
                {
                    "_id": "u1",
                    "full_name": "Edu",
                    "phone": "5548999999999",
                    "is_active": True,
                }
            ]
        )
        tokens_cursor = MagicMock()
        tokens_cursor.to_list = AsyncMock(return_value=[])

        db = MagicMock()
        db.system_settings.find_one = AsyncMock(
            return_value={"_id": "whatsapp", "service_enabled": False}
        )
        db.users.find = MagicMock(return_value=users_cursor)
        db.device_tokens.find = MagicMock(return_value=tokens_cursor)

        scheduler = NotificationScheduler(db, whatsapp)

        with (
            patch(
                "services.notification_scheduler.NotificationLock"
            ) as MockLock,
            patch.object(
                scheduler, "_check_expenses", new_callable=AsyncMock
            ) as mock_expenses,
            patch.object(
                scheduler, "_check_debts", new_callable=AsyncMock
            ) as mock_debts,
        ):
            lock = MockLock.return_value
            lock.acquire_lock = AsyncMock(return_value=True)
            lock.release_lock = AsyncMock()

            await scheduler.check_and_send_notifications()

        # Sem tokens FCM e WhatsApp off → não chama checks
        mock_expenses.assert_not_called()
        mock_debts.assert_not_called()

    async def test_scheduler_skips_user_with_whatsapp_disabled(self):
        from services.notification_scheduler import NotificationScheduler
        from services.whatsapp_notification import WhatsAppNotificationService

        whatsapp = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )

        users_cursor = MagicMock()
        users_cursor.to_list = AsyncMock(
            return_value=[
                {
                    "_id": "u-disabled",
                    "full_name": "Desativado",
                    "phone": "5548999999999",
                    "is_active": True,
                    "whatsapp_notifications_enabled": False,
                },
                {
                    "_id": "u-enabled",
                    "full_name": "Ativo",
                    "phone": "5548984464815",
                    "is_active": True,
                    "whatsapp_notifications_enabled": True,
                },
            ]
        )
        tokens_cursor = MagicMock()
        tokens_cursor.to_list = AsyncMock(return_value=[])

        db = MagicMock()
        db.system_settings.find_one = AsyncMock(return_value=None)
        db.users.find = MagicMock(return_value=users_cursor)
        db.device_tokens.find = MagicMock(return_value=tokens_cursor)
        db.expenses.find = MagicMock(
            return_value=MagicMock(to_list=AsyncMock(return_value=[]))
        )
        db.debts.find = MagicMock(
            return_value=MagicMock(to_list=AsyncMock(return_value=[]))
        )

        scheduler = NotificationScheduler(db, whatsapp)
        whatsapp.test_connection = MagicMock(return_value=(True, "ok"))

        with (
            patch(
                "services.notification_scheduler.NotificationLock"
            ) as MockLock,
            patch.object(
                scheduler, "_check_expenses", new_callable=AsyncMock
            ) as mock_expenses,
            patch.object(
                scheduler, "_check_debts", new_callable=AsyncMock
            ) as mock_debts,
        ):
            lock = MockLock.return_value
            lock.acquire_lock = AsyncMock(return_value=True)
            lock.release_lock = AsyncMock()

            await scheduler.check_and_send_notifications()

        # Só o usuário com WhatsApp ativo (sem FCM tokens nos dois)
        assert mock_expenses.await_count == 1
        assert mock_debts.await_count == 1
        assert mock_expenses.await_args.args[0] == "u-enabled"
        assert mock_debts.await_args.args[0] == "u-enabled"

    async def test_scheduler_fcm_only_user_without_phone(self):
        from services.notification_scheduler import NotificationScheduler
        from services.whatsapp_notification import WhatsAppNotificationService

        whatsapp = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )

        users_cursor = MagicMock()
        users_cursor.to_list = AsyncMock(
            return_value=[
                {
                    "_id": "u-fcm",
                    "full_name": "Só App",
                    "phone": None,
                    "is_active": True,
                }
            ]
        )
        tokens_cursor = MagicMock()
        tokens_cursor.to_list = AsyncMock(
            return_value=[{"token": "fcm-token-abc", "active": True}]
        )

        db = MagicMock()
        db.system_settings.find_one = AsyncMock(return_value=None)
        db.users.find = MagicMock(return_value=users_cursor)
        db.device_tokens.find = MagicMock(return_value=tokens_cursor)

        scheduler = NotificationScheduler(db, whatsapp)
        whatsapp.test_connection = MagicMock(return_value=(True, "ok"))

        with (
            patch(
                "services.notification_scheduler.NotificationLock"
            ) as MockLock,
            patch.object(
                scheduler, "_check_expenses", new_callable=AsyncMock
            ) as mock_expenses,
            patch.object(
                scheduler, "_check_debts", new_callable=AsyncMock
            ) as mock_debts,
        ):
            lock = MockLock.return_value
            lock.acquire_lock = AsyncMock(return_value=True)
            lock.release_lock = AsyncMock()

            await scheduler.check_and_send_notifications()

        mock_expenses.assert_awaited_once()
        assert mock_expenses.await_args.args[0] == "u-fcm"
        assert mock_expenses.await_args.args[2] is None  # phone
        assert mock_expenses.await_args.kwargs.get("fcm_tokens") == [
            "fcm-token-abc"
        ] or mock_expenses.await_args.args[3] == ["fcm-token-abc"]
        mock_debts.assert_awaited_once()

    async def test_scheduler_retries_waha_when_startup_left_client_missing(self):
        """Probe da subida falhou (cliente None): o ciclo seguinte reconecta."""
        from services.notification_scheduler import NotificationScheduler
        from services.whatsapp_notification import WhatsAppNotificationService

        whatsapp = WhatsAppNotificationService(
            base_url="http://waha:3000", api_key="k", session="default"
        )
        whatsapp.test_connection = MagicMock(
            side_effect=[(False, "down"), (True, "up")]
        )

        users_cursor = MagicMock()
        users_cursor.to_list = AsyncMock(
            return_value=[
                {
                    "_id": "u1",
                    "full_name": "Edu",
                    "phone": "5548984464815",
                    "is_active": True,
                }
            ]
        )
        tokens_cursor = MagicMock()
        tokens_cursor.to_list = AsyncMock(return_value=[])

        db = MagicMock()
        db.system_settings.find_one = AsyncMock(return_value=None)
        db.users.find = MagicMock(return_value=users_cursor)
        db.device_tokens.find = MagicMock(return_value=tokens_cursor)

        scheduler = NotificationScheduler(db, None)

        with (
            patch(
                "services.whatsapp_notification.build_whatsapp_service",
                return_value=whatsapp,
            ),
            patch(
                "services.notification_scheduler.NotificationLock"
            ) as MockLock,
            patch.object(
                scheduler, "_check_expenses", new_callable=AsyncMock
            ) as mock_expenses,
        ):
            lock = MockLock.return_value
            lock.acquire_lock = AsyncMock(return_value=True)
            lock.release_lock = AsyncMock()

            await scheduler.check_and_send_notifications()
            assert scheduler.whatsapp is whatsapp
            mock_expenses.assert_not_called()

            await scheduler.check_and_send_notifications()

        mock_expenses.assert_awaited_once()
        assert mock_expenses.await_args.args[2] == "5548984464815"

