import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to_email: str, subject: str, body: str, html_body: str | None = None
) -> tuple[bool, str | None]:
    """
    Envia email usando SMTP do Gmail

    Args:
        to_email: Email do destinatário
        subject: Assunto do email
        body: Corpo do email em texto plano
        html_body: Corpo do email em HTML (opcional)

    Returns:
        Tupla (sucesso: bool, mensagem_erro: Optional[str])
    """
    try:
        # Verificar se as configurações de email estão definidas
        if not settings.email_user or not settings.email_pass:
            error_msg = (
                "Configurações de email não definidas. "
                "Configure a senha de app do Gmail."
            )
            logger.warning(error_msg)
            return False, error_msg

        # Criar mensagem
        message = MIMEMultipart("alternative")
        # Usar nome mascarado se configurado, senão usar email real
        # Formato: "Nome Mascarado <email_real>" para mascarar corretamente
        if settings.email_from_name and (
            settings.email_from_name != settings.email_user
        ):
            from_address = f"{settings.email_from_name} <{settings.email_user}>"
        else:
            from_address = settings.email_user
        message["From"] = from_address
        message["To"] = to_email
        message["Subject"] = subject

        # Adicionar corpo do email
        text_part = MIMEText(body, "plain", "utf-8")
        message.attach(text_part)

        if html_body:
            html_part = MIMEText(html_body, "html", "utf-8")
            message.attach(html_part)

        # Enviar email via SMTP configurado
        smtp_host = settings.smtp_host or "smtp.gmail.com"
        smtp_port = settings.smtp_port or 587
        use_tls = settings.smtp_use_tls if settings.smtp_use_tls is not None else True

        # Para Gmail:
        # - Porta 587: usar STARTTLS (conexão normal, depois inicia TLS)
        # - Porta 465: usar SSL direto (conexão já criptografada)

        if smtp_port == 465:
            # Porta 465: usar SSL direto
            smtp = aiosmtplib.SMTP(hostname=smtp_host, port=smtp_port, use_tls=True)
            await smtp.connect()
            await smtp.login(settings.email_user, settings.email_pass)
            await smtp.send_message(message)
            await smtp.quit()
        else:
            # Porta 587: usar STARTTLS (conexão normal primeiro, depois TLS)
            smtp = aiosmtplib.SMTP(hostname=smtp_host, port=smtp_port, use_tls=False)
            await smtp.connect()
            if use_tls:
                await smtp.starttls()
            await smtp.login(settings.email_user, settings.email_pass)
            await smtp.send_message(message)
            await smtp.quit()

        logger.info(f"Email enviado com sucesso para {to_email}")
        return True, None

    except aiosmtplib.SMTPAuthenticationError as e:
        error_msg = (
            "Erro de autenticação: Usuário ou senha incorretos. "
            "Verifique se a senha de app do Gmail está correta. Detalhes: "
            f"{str(e)}"
        )
        logger.error(error_msg)
        return False, error_msg
    except aiosmtplib.SMTPConnectError as e:
        error_msg = (
            "Erro de conexão: Não foi possível conectar ao servidor SMTP "
            f"({settings.smtp_host or 'smtp.gmail.com'}:"
            f"{settings.smtp_port or 587}). "
            "Verifique se o host e porta estão corretos. Detalhes: "
            f"{str(e)}"
        )
        logger.error(error_msg)
        return False, error_msg
    except aiosmtplib.SMTPException as e:
        error_msg = f"Erro SMTP: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Erro inesperado ao enviar email: {str(e)}"
        logger.error(error_msg)
        return False, error_msg
