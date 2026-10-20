"""Endpoints de backup MongoDB → Google Drive."""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from database import get_database
from models.user import User
from services import backup_service, google_drive as gdrive
from utils.deps import get_current_super_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/backup", tags=["Backup"])


class GoogleExchangeBody(BaseModel):
    code: str = Field(..., min_length=1)
    state: str = Field(..., min_length=1)


@router.get("/status")
async def backup_status(current_user: User = Depends(get_current_super_admin)):
    """Status da conexão Google Drive e dos 3 slots de backup."""
    db = await get_database()
    return await gdrive.get_public_status(db)


@router.get("/google/auth-url")
async def google_auth_url(current_user: User = Depends(get_current_super_admin)):
    """Inicia OAuth no navegador (Google consent)."""
    try:
        state = secrets.token_urlsafe(32)
        db = await get_database()
        auth_url, effective_state, code_verifier = gdrive.build_auth_url(state)
        await gdrive.save_oauth_state(
            db,
            effective_state,
            str(current_user.id),
            code_verifier=code_verifier,
        )
        from config import settings as app_settings

        return {
            "auth_url": auth_url,
            "redirect_uri": app_settings.google_redirect_uri,
        }
    except gdrive.GoogleDriveNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


async def _complete_oauth(db, *, code: str, state: str) -> dict:
    consumed = await gdrive.consume_oauth_state(db, state)
    if not consumed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="State OAuth inválido ou expirado. Clique em Conectar novamente.",
        )
    user_id, code_verifier = consumed
    try:
        credentials = gdrive.exchange_code(code, code_verifier=code_verifier)
        return await gdrive.save_connection(
            db, credentials, connected_by=user_id
        )
    except gdrive.GoogleDriveNotConnectedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha ao trocar code OAuth")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha ao concluir login Google: {exc}",
        ) from exc


@router.post("/google/exchange")
async def google_exchange(
    body: GoogleExchangeBody,
    current_user: User = Depends(get_current_super_admin),
):
    """Troca code/state (vindo do redirect no frontend) pelo refresh token."""
    db = await get_database()
    status_doc = await _complete_oauth(db, code=body.code, state=body.state)
    return {"message": "Google Drive conectado", **status_doc}


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    """
    Callback server-side (se GOOGLE_REDIRECT_URI apontar para a API).
    Em dev preferimos redirect no frontend + POST /google/exchange.
    """
    if error:
        return RedirectResponse(
            gdrive.frontend_redirect({"backup": "error", "message": error})
        )
    if not code or not state:
        logger.warning(
            "OAuth callback sem code/state. query=%s",
            dict(request.query_params),
        )
        return RedirectResponse(
            gdrive.frontend_redirect(
                {
                    "backup": "error",
                    "message": (
                        "Código ou state ausente. "
                        "Use redirect URI do frontend: "
                        "http://localhost:3000/dashboard/settings"
                    ),
                }
            )
        )

    db = await get_database()
    try:
        await _complete_oauth(db, code=code, state=state)
        return RedirectResponse(
            gdrive.frontend_redirect({"backup": "connected"})
        )
    except HTTPException as exc:
        return RedirectResponse(
            gdrive.frontend_redirect(
                {"backup": "error", "message": str(exc.detail)}
            )
        )


@router.delete("/google")
async def google_disconnect(
    current_user: User = Depends(get_current_super_admin),
):
    """Remove refresh token e metadados do Drive."""
    db = await get_database()
    await gdrive.disconnect(db)
    return {"message": "Google Drive desconectado", "connected": False}


@router.post("/run")
async def run_backup_now(
    current_user: User = Depends(get_current_super_admin),
    force_all_slots: bool = Query(
        False,
        description="Se true, atualiza daily+weekly+monthly nesta execução",
    ),
):
    """Dispara backup manual imediatamente."""
    db = await get_database()
    try:
        if force_all_slots:
            await db.system_settings.update_one(
                {"_id": gdrive.SETTINGS_ID},
                {"$unset": {"last_weekly_key": "", "last_monthly_key": ""}},
            )
        result = await backup_service.run_backup(
            db, triggered_by=f"manual:{current_user.email}"
        )
        return result
    except gdrive.GoogleDriveNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except gdrive.GoogleDriveNotConnectedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except backup_service.BackupError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT
            if "andamento" in str(exc).lower()
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha no backup: {exc}",
        ) from exc
