import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from textwrap import dedent

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm

from config import settings
from database import get_database
from models.access_log import AccessStatus
from models.token import Token
from services.access_log_service import AccessLogService
from utils.auth_cookies import clear_auth_cookie, set_auth_cookie
from utils.email import send_email
from utils.ip_utils import get_client_ip
from utils.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Autenticação"])

FORGOT_PASSWORD_GENERIC_RESPONSE = {
    "message": (
        "Se o email estiver cadastrado, enviaremos instruções "
        "para redefinir sua senha."
    )
}


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """Login do usuário"""
    db = await get_database()
    access_log_service = AccessLogService(db)

    # Extrai IP real do cliente (considerando proxies)
    ip_address = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown") if request else "unknown"

    # Busca o usuário
    user = await db.users.find_one({"email": form_data.username})

    # Se usuário não existe ou senha incorreta
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        # Registra tentativa falhada
        await access_log_service.log_access(
            user_email=form_data.username,
            user_id=None,
            status=AccessStatus.INVALID_CREDENTIALS,
            ip_address=ip_address,
            user_agent=user_agent,
            error_message="Email ou senha incorretos",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Se usuário existe mas está inativo
    if not user.get("is_active", True):
        # Registra tentativa com usuário inativo
        await access_log_service.log_access(
            user_email=form_data.username,
            user_id=str(user["_id"]),
            status=AccessStatus.INACTIVE_USER,
            ip_address=ip_address,
            user_agent=user_agent,
            error_message="Usuário inativo",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Usuário inativo"
        )

    # Cria o token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["email"], "user_id": str(user["_id"])},
        expires_delta=access_token_expires,
    )

    # Registra acesso bem-sucedido
    await access_log_service.log_access(
        user_email=user["email"],
        user_id=str(user["_id"]),
        status=AccessStatus.SUCCESS,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    response = JSONResponse(
        content={"access_token": access_token, "token_type": "bearer"}
    )
    set_auth_cookie(response, access_token, access_token_expires)
    return response


@router.post("/logout")
async def logout():
    """Encerra sessão removendo o cookie HttpOnly."""
    response = JSONResponse(content={"message": "Logout realizado com sucesso"})
    clear_auth_cookie(response)
    return response


@router.post("/forgot-password")
async def forgot_password(email: str):
    """Solicita reset de senha via email"""
    db = await get_database()

    # Busca o usuário — resposta sempre genérica (evita enumeração de emails)
    user = await db.users.find_one({"email": email})
    if not user or not user.get("is_active", True):
        return FORGOT_PASSWORD_GENERIC_RESPONSE

    # Gera token de reset
    reset_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(reset_token.encode()).hexdigest()

    # Salva token no banco (expira em 1 hora)
    expires_at = datetime.now(UTC) + timedelta(hours=1)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_token": token_hash, "reset_token_expires": expires_at}},
    )

    # Envia email com link de reset
    frontend_url = settings.frontend_url or "https://contas.example.com"
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    html_body = dedent(f"""
    <html>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 24px;">
        <h2 style="margin: 0 0 12px; color: #1f2937;">Redefinição de senha</h2>
        <p style="margin: 0 0 12px; color: #374151;">
          Olá {user.get("full_name", "Usuário")},
        </p>
        <p style="margin: 0 0 12px; color: #4b5563;">
          Você solicitou a redefinição de senha para sua conta no Controle de
          Contas.
        </p>
        <p style="margin: 0 0 12px; color: #4b5563;">
                    O link é válido por <strong>1 hora</strong>.
                    Depois disso, solicite um novo.
        </p>
        <p style="margin: 0 0 20px; color: #4b5563;">
          Clique no botão abaixo para redefinir sua senha.
        </p>
        <p style="margin: 0 0 24px;">
          <a href="{reset_link}"
             style="background: #dc2626; color: #ffffff; text-decoration: none;
                    padding: 14px 24px; border-radius: 6px; font-weight: 600;
                    display: inline-block;">
            Redefinir senha
          </a>
        </p>
                <p style="margin: 0; color: #6b7280; font-size: 13px;
                                    line-height: 1.5;">
          Se você não solicitou esta redefinição, ignore este email. Nenhuma
          alteração será feita.
        </p>
      </body>
    </html>
    """)

    text_body = dedent(f"""
    Redefinição de Senha - Controle de Contas

    Olá {user.get("full_name", "Usuário")},

    Você solicitou a redefinição de senha para sua conta no Controle de Contas.

    IMPORTANTE: Este link é válido por 1 hora a partir do envio deste email.
    Após esse período, será necessário solicitar um novo link de redefinição.

    Clique no link abaixo para redefinir sua senha:
    {reset_link}

    Segurança: Se você não solicitou esta redefinição, ignore este email.
    Nenhuma alteração será feita em sua conta.
    """)

    email_sent, error_message = await send_email(
        to_email=email,
        subject="Redefinição de Senha - Controle de Contas",
        body=text_body,
        html_body=html_body,
    )

    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                error_message
                or "Erro ao enviar email. Verifique as configurações de email."
            ),
        )

    return FORGOT_PASSWORD_GENERIC_RESPONSE


@router.post("/reset-password")
async def reset_password(token: str, new_password: str):
    """Redefine a senha usando o token"""
    db = await get_database()

    # Hash do token recebido
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Busca usuário com token válido
    user = await db.users.find_one(
        {
            "reset_token": token_hash,
            "reset_token_expires": {"$gt": datetime.now(UTC)},
        }
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Token inválido ou expirado"
        )

    # Atualiza senha e remove token
    hashed_password = get_password_hash(new_password)
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"hashed_password": hashed_password},
            "$unset": {"reset_token": "", "reset_token_expires": ""},
        },
    )

    return {"message": "Senha redefinida com sucesso"}
