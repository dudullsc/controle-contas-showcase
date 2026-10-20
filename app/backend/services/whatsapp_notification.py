"""
Serviço de Notificações via WhatsApp usando API WAHA
Integra-se com o sistema WAHA para enviar mensagens automaticamente
"""

import logging
from datetime import datetime

import requests

from config import settings

logger = logging.getLogger(__name__)


def build_whatsapp_service() -> "WhatsAppNotificationService | None":
    """Cria o cliente WAHA a partir das configurações. None se não houver API key."""
    api_key = getattr(settings, "waha_api_key", None)
    if not api_key:
        return None
    return WhatsAppNotificationService(
        base_url=getattr(settings, "waha_base_url", None)
        or "https://botzap.example.com",
        api_key=api_key,
        session=getattr(settings, "waha_session", None) or "default",
    )


class WhatsAppNotificationService:
    """Serviço para enviar notificações via WhatsApp através da API WAHA"""

    portal_url = "https://contas.example.com/login"

    def __init__(
        self,
        base_url: str = "https://botzap.example.com",
        api_key: str = None,
        session: str | None = None,
    ):
        """
        Inicializa o serviço WhatsApp

        Args:
            base_url: URL base da API WAHA
            api_key: Chave de API fixa configurada
            session: Nome da session WAHA (default: settings.waha_session)
        """
        self.base_url = base_url
        self.api_key = api_key or self._get_api_key_from_settings()
        self.timeout = 10
        self.session = session or getattr(settings, "waha_session", None) or "default"

    def _get_api_key_from_settings(self) -> str | None:
        """Obtém a API Key das configurações"""
        return getattr(settings, "waha_api_key", None)

    def _status_of_session(self, payload) -> str | None:
        """Lê o status da sessão configurada na resposta de GET /api/sessions."""
        if isinstance(payload, dict):
            return payload.get("status")
        if isinstance(payload, list):
            for item in payload:
                if isinstance(item, dict) and item.get("name") == self.session:
                    return item.get("status")
        return None

    def _normalize_user_name(self, user_name: str | None) -> str:
        """Normaliza nome do usuário para exibição na mensagem"""
        if user_name and user_name.strip():
            return user_name.strip()
        return "Cliente"

    def _format_message(self, user_name: str | None, body: str) -> str:
        """Monta mensagem com identificação e link do portal"""
        display_name = self._normalize_user_name(user_name)
        return (
            f"Olá {display_name}!\n"
            "✅ Aviso automático do nosso sistema Controle de Contas.\n\n"
            f"{body}\n\n"
            f"Acesse: {self.portal_url}"
        )

    def test_connection(self) -> tuple[bool, str]:
        """
        Testa a conexão com a API WAHA

        Returns:
            Tupla (sucesso, mensagem)
        """
        logger.info("Testando conexão com API WAHA...")

        if not self.api_key:
            return False, "API Key do WAHA não configurada"

        try:
            url = f"{self.base_url}/api/sessions"
            headers = {"X-Api-Key": self.api_key}
            response = requests.get(url, headers=headers, timeout=self.timeout)

            if response.status_code == 200:
                sessions = response.json()
                status = self._status_of_session(sessions)
                if status == "WORKING":
                    logger.info(
                        f"✅ Conexão com WAHA estabelecida. Sessão {self.session}: WORKING"
                    )
                    return True, f"Conectado com sucesso. Sessão {self.session}: WORKING"
                logger.warning(
                    "⏸️  Sessão WAHA %s está %s, esperado WORKING",
                    self.session,
                    status or "ausente",
                )
                return (
                    False,
                    f"Sessão {self.session} está {status or 'ausente'}, esperado WORKING",
                )
            elif response.status_code == 401:
                logger.error("❌ API KEY inválida")
                return False, "API Key inválida. Verifique a configuração."
            else:
                logger.error(f"❌ Erro inesperado: {response.status_code}")
                return False, f"Erro na conexão: {response.status_code}"

        except requests.exceptions.Timeout:
            logger.error("❌ Timeout na conexão")
            return False, "Timeout ao conectar com o servidor WAHA"
        except requests.exceptions.ConnectionError as e:
            logger.error(f"❌ Erro de conexão: {e}")
            return False, f"Erro de conexão: {str(e)}"
        except Exception as e:
            logger.error(f"❌ Erro inesperado: {e}")
            return False, f"Erro inesperado: {str(e)}"

    def send_text_message(self, phone_number: str, message: str) -> tuple[bool, str]:
        """
        Envia uma mensagem de texto via WhatsApp

        Args:
            phone_number: Número do WhatsApp destino (formato: 5521999999999)
            message: Texto da mensagem

        Returns:
            Tupla (sucesso, mensagem/erro)
        """
        logger.info(f"Enviando mensagem para {phone_number}...")

        if not self.api_key:
            logger.error("API Key não configurada")
            return False, "API Key não configurada"

        try:
            # Formata o chat ID para WhatsApp
            chat_id = f"{phone_number}@c.us"

            url = f"{self.base_url}/api/sendText"
            headers = {"X-Api-Key": self.api_key}
            payload = {"chatId": chat_id, "text": message, "session": self.session}

            response = requests.post(
                url, json=payload, headers=headers, timeout=self.timeout
            )

            if response.status_code in [200, 201]:
                logger.info(f"✅ Mensagem enviada com sucesso para {phone_number}")
                return True, "Mensagem enviada com sucesso"
            else:
                error_msg = response.text or f"Status {response.status_code}"
                logger.error(f"❌ Erro ao enviar: {error_msg}")
                return False, f"Erro ao enviar mensagem: {error_msg}"

        except requests.exceptions.Timeout:
            logger.error("❌ Timeout ao enviar mensagem")
            return False, "Timeout ao enviar mensagem"
        except requests.exceptions.ConnectionError as e:
            logger.error(f"❌ Erro de conexão: {e}")
            return False, f"Erro de conexão: {str(e)}"
        except Exception as e:
            logger.error(f"❌ Erro inesperado: {e}")
            return False, f"Erro ao enviar: {str(e)}"

    def send_notification_expense_5_days_before(
        self,
        phone_number: str,
        user_name: str | None,
        expense_description: str,
        amount: float,
        due_date: datetime,
    ) -> tuple[bool, str]:
        """
        Envia notificação: Conta vencendo em 5 dias
        """
        due_date_str = due_date.strftime("%d/%m/%Y")
        amount_str = (
            f"R$ {amount:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
        )

        body = (
            f"🔔 *LEMBRETE: Sua conta vence em 5 dias*\n\n"
            f"📝 {expense_description}\n"
            f"💰 Valor: {amount_str}\n"
            f"📅 Vencimento: {due_date_str}\n\n"
            f"Organize-se para não esquecer! 😊"
        )
        message = self._format_message(user_name, body)

        return self.send_text_message(phone_number, message)

    def send_notification_expense_1_day_before(
        self,
        phone_number: str,
        user_name: str | None,
        expense_description: str,
        amount: float,
        due_date: datetime,
    ) -> tuple[bool, str]:
        """
        Envia notificação: Conta vencendo amanhã
        """
        due_date_str = due_date.strftime("%d/%m/%Y")
        amount_str = (
            f"R$ {amount:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
        )

        body = (
            f"⚠️ *ATENÇÃO: Sua conta vence AMANHÃ*\n\n"
            f"📝 {expense_description}\n"
            f"💰 Valor: {amount_str}\n"
            f"📅 Vencimento: {due_date_str}\n\n"
            f"Não esqueça de pagar! 🚨"
        )
        message = self._format_message(user_name, body)

        return self.send_text_message(phone_number, message)

    def send_notification_expense_overdue(
        self,
        phone_number: str,
        user_name: str | None,
        expense_description: str,
        amount: float,
        due_date: datetime,
        days_overdue: int,
    ) -> tuple[bool, str]:
        """
        Envia notificação: Conta em atraso
        """
        due_date_str = due_date.strftime("%d/%m/%Y")
        amount_str = (
            f"R$ {amount:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
        )

        if days_overdue == 0:
            body = (
                f"⚠️ *ATENÇÃO: Sua conta vence HOJE*\n\n"
                f"📝 {expense_description}\n"
                f"💰 Valor: {amount_str}\n"
                f"📅 Vencimento: {due_date_str}\n\n"
                f"Pague hoje para evitar juros e multa. 💸"
            )
        else:
            body = (
                f"🚨 *URGENTE: Sua conta está em atraso*\n\n"
                f"📝 {expense_description}\n"
                f"💰 Valor: {amount_str}\n"
                f"📅 Venceu em: {due_date_str}\n"
                f"⏱️ Dias em atraso: {days_overdue}\n\n"
                f"Por favor, procure liquidar este débito o mais breve possível! ⚠️"
            )
        message = self._format_message(user_name, body)

        return self.send_text_message(phone_number, message)

    def send_notification_debt_5_days_before(
        self,
        phone_number: str,
        user_name: str | None,
        debt_name: str,
        amount: float,
        due_date: datetime,
    ) -> tuple[bool, str]:
        """
        Envia notificação: Dívida vencendo em 5 dias
        """
        due_date_str = due_date.strftime("%d/%m/%Y")
        amount_str = (
            f"R$ {amount:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
        )

        body = (
            f"📌 *LEMBRETE: Sua dívida vence em 5 dias*\n\n"
            f"💳 {debt_name}\n"
            f"💰 Valor: {amount_str}\n"
            f"📅 Vencimento: {due_date_str}\n\n"
            f"Organize-se para quitar! 💪"
        )
        message = self._format_message(user_name, body)

        return self.send_text_message(phone_number, message)

    def send_notification_debt_1_day_before(
        self,
        phone_number: str,
        user_name: str | None,
        debt_name: str,
        amount: float,
        due_date: datetime,
    ) -> tuple[bool, str]:
        """
        Envia notificação: Dívida vencendo amanhã
        """
        due_date_str = due_date.strftime("%d/%m/%Y")
        amount_str = (
            f"R$ {amount:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
        )

        body = (
            f"⚠️ *ATENÇÃO: Sua dívida vence AMANHÃ*\n\n"
            f"💳 {debt_name}\n"
            f"💰 Valor: {amount_str}\n"
            f"📅 Vencimento: {due_date_str}\n\n"
            f"Não deixe perder o prazo! 🚀"
        )
        message = self._format_message(user_name, body)

        return self.send_text_message(phone_number, message)

    def send_notification_debt_overdue(
        self,
        phone_number: str,
        user_name: str | None,
        debt_name: str,
        amount: float,
        due_date: datetime,
        days_overdue: int,
    ) -> tuple[bool, str]:
        """
        Envia notificação: Dívida em atraso
        """
        due_date_str = due_date.strftime("%d/%m/%Y")
        amount_str = (
            f"R$ {amount:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
        )

        if days_overdue == 0:
            body = (
                f"⚠️ *ATENÇÃO: Sua dívida vence HOJE*\n\n"
                f"💳 {debt_name}\n"
                f"💰 Valor: {amount_str}\n"
                f"📅 Vencimento: {due_date_str}\n\n"
                f"Quite hoje para evitar juros e encargos. 💸"
            )
        else:
            body = (
                f"🔴 *URGENTE: Sua dívida está em atraso*\n\n"
                f"💳 {debt_name}\n"
                f"💰 Valor: {amount_str}\n"
                f"📅 Venceu em: {due_date_str}\n"
                f"⏱️ Dias em atraso: {days_overdue}\n\n"
                f"Procure quitar este débito com urgência! 🚨"
            )
        message = self._format_message(user_name, body)

        return self.send_text_message(phone_number, message)
