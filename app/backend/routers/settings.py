import os
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from config import settings
from models.user import User
from utils.deps import get_current_admin_or_super, get_current_super_admin

router = APIRouter(prefix="/settings", tags=["Configurações"])


class EmailConfig(BaseModel):
    email_user: EmailStr
    email_pass: str
    email_from_name: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_use_tls: bool | None = None


@router.post("/email")
async def update_email_config(
    config: EmailConfig, current_user: User = Depends(get_current_admin_or_super)
):
    """Atualiza configurações de email (apenas admin)"""
    # Validação básica de email (não mais fixo, mas pode ter validações
    # adicionais se necessário)
    # Removida a validação que forçava contato@example.com

    # Salvar configurações em variáveis de ambiente (arquivo .env)
    # Em produção, considere usar um vault ou banco de dados seguro
    env_file_path = ".env"
    env_vars = {}

    # Ler .env existente se houver
    if os.path.exists(env_file_path):
        with open(env_file_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()

    # Atualizar variáveis de email
    env_vars["EMAIL_USER"] = config.email_user
    env_vars["EMAIL_PASS"] = config.email_pass
    if config.email_from_name:
        env_vars["EMAIL_FROM_NAME"] = config.email_from_name
    if config.smtp_host:
        env_vars["SMTP_HOST"] = config.smtp_host
    if config.smtp_port:
        env_vars["SMTP_PORT"] = str(config.smtp_port)
    if config.smtp_use_tls is not None:
        env_vars["SMTP_USE_TLS"] = str(config.smtp_use_tls).lower()

    # Escrever de volta no .env
    with open(env_file_path, "w", encoding="utf-8") as f:
        for key, value in env_vars.items():
            f.write(f"{key}={value}\n")

    return {"message": "Configuração de email salva com sucesso"}


@router.get("/email")
async def get_email_config(current_user: User = Depends(get_current_admin_or_super)):
    """Retorna status da configuração de email (apenas admin)"""
    return {
        "email_user": (settings.email_user or "contato@example.com"),
        "email_from_name": (
            settings.email_from_name or "resetpassword@contas.example.com"
        ),
        "smtp_host": settings.smtp_host or "smtp.gmail.com",
        "smtp_port": settings.smtp_port or 587,
        "smtp_use_tls": (
            settings.smtp_use_tls if settings.smtp_use_tls is not None else True
        ),
        "email_configured": (
            settings.email_pass is not None and settings.email_pass != ""
        ),
    }


class TestEmailRequest(BaseModel):
    to_email: EmailStr


@router.post("/email/test")
async def test_email(
    request: TestEmailRequest, current_user: User = Depends(get_current_admin_or_super)
):
    """Envia email de teste para verificar configuração.
    Apenas admin.
    """
    from utils.email import send_email

    # Verificar se email está configurado
    if not settings.email_pass:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Email não configurado. Configure a senha de app do Gmail primeiro."
            ),
        )

    # Criar email de teste
    subject = "Teste de Email - Controle de Contas"
    tls_status = (
        "Habilitado"
        if (settings.smtp_use_tls if settings.smtp_use_tls is not None else True)
        else "Desabilitado"
    )
    text_body = f"""
    Este é um email de teste do sistema Controle de Contas.

    Se você recebeu este email, a configuração está funcionando!

    Configurações atuais:
    - SMTP Host: {settings.smtp_host or "smtp.gmail.com"}
    - SMTP Port: {settings.smtp_port or 587}
    - TLS/SSL: {tls_status}
    - From: {settings.email_from_name or settings.email_user}

    Data/Hora do teste: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}
    """

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif;
                   line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">
            ✅ Teste de Email - Controle de Contas
          </h2>
          <p>Este é um email de teste do sistema Controle de Contas.</p>
          <p><strong>
            Se você recebeu este email, a configuração está funcionando!
          </strong></p>

          <div style="background-color: #f3f4f6; padding: 15px;
                      border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Configurações atuais:</h3>
            <ul>
              <li><strong>SMTP Host:</strong>
                {settings.smtp_host or "smtp.gmail.com"}
              </li>
              <li><strong>SMTP Port:</strong>
                {settings.smtp_port or 587}
              </li>
              <li><strong>TLS/SSL:</strong> {tls_status}</li>
              <li><strong>From:</strong>
                {settings.email_from_name or settings.email_user}
              </li>
            </ul>
          </div>

          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Data/Hora: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}
          </p>
        </div>
      </body>
    </html>
    """

    email_sent, error_message = await send_email(
        to_email=request.to_email, subject=subject, body=text_body, html_body=html_body
    )

    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                error_message
                or ("Erro ao enviar email de teste. Verifique as configurações SMTP.")
            ),
        )

    return {"message": (f"Email de teste enviado com sucesso para {request.to_email}")}


class WhatsAppServiceConfig(BaseModel):
    service_enabled: bool


@router.get("/whatsapp")
async def get_whatsapp_settings(
    current_user: User = Depends(get_current_super_admin),
):
    """Retorna status do serviço WhatsApp (apenas superadmin)."""
    from database import get_database

    db = await get_database()
    doc = await db.system_settings.find_one({"_id": "whatsapp"})
    return {
        "service_enabled": (
            True if doc is None else bool(doc.get("service_enabled", True))
        )
    }


@router.put("/whatsapp")
async def update_whatsapp_settings(
    config: WhatsAppServiceConfig,
    current_user: User = Depends(get_current_super_admin),
):
    """Ativa ou desativa o serviço WhatsApp globalmente (apenas superadmin)."""
    from database import get_database

    db = await get_database()
    await db.system_settings.update_one(
        {"_id": "whatsapp"},
        {
            "$set": {
                "service_enabled": config.service_enabled,
                "updated_at": datetime.now(UTC),
                "updated_by": str(current_user.id),
            }
        },
        upsert=True,
    )
    return {
        "service_enabled": config.service_enabled,
        "message": (
            "Serviço WhatsApp ativado"
            if config.service_enabled
            else "Serviço WhatsApp desativado"
        ),
    }
