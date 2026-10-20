"""Cliente Google Drive (OAuth2) para upload de backups."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from config import settings

logger = logging.getLogger(__name__)

DRIVE_API_SCOPE = "https://www.googleapis.com/auth/drive"
# O backup lista pastas existentes e atualiza/exclui arquivos dos slots.
DRIVE_SCOPES = [
    DRIVE_API_SCOPE,
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]
SETTINGS_ID = "google_drive_backup"
OAUTH_STATE_ID = "google_drive_oauth_state"

SLOT_FILENAMES = {
    "daily": "controle_contas_daily.archive.gz",
    "weekly": "controle_contas_weekly.archive.gz",
    "monthly": "controle_contas_monthly.archive.gz",
}


class GoogleDriveNotConfiguredError(Exception):
    """Client ID/Secret ausentes."""


class GoogleDriveNotConnectedError(Exception):
    """Refresh token ainda não autorizado."""


def _log_drive_http_error(operation: str, exc: HttpError) -> None:
    """Registra erros da API sem incluir tokens ou credenciais nos logs."""
    status = getattr(exc.resp, "status", "desconhecido")
    reason = None
    message = None
    try:
        content = exc.content
        if isinstance(content, bytes):
            content = content.decode("utf-8", errors="replace")
        payload = json.loads(content or "{}")
        error = payload.get("error") or {}
        message = error.get("message")
        reasons = error.get("errors") or []
        if reasons:
            reason = reasons[0].get("reason")
    except (TypeError, ValueError, AttributeError, IndexError):
        pass

    logger.error(
        "Google Drive API falhou: operation=%s status=%s reason=%s message=%s",
        operation,
        status,
        reason or "não informado",
        message or "não informado",
        exc_info=status not in (401, 403),
    )
    if status == 401:
        logger.error(
            "Google Drive retornou 401: access token inválido/expirado ou "
            "refresh token rejeitado; será necessário reconectar se o refresh "
            "falhar."
        )
    elif status == 403:
        logger.error(
            "Google Drive retornou 403: verifique os escopos OAuth autorizados "
            "e se a conta possui acesso ao recurso."
        )


def _execute_drive_request(request, *, operation: str):
    try:
        return request.execute()
    except HttpError as exc:
        _log_drive_http_error(operation, exc)
        raise


def _require_oauth_client() -> tuple[str, str, str]:
    client_id = (settings.google_client_id or "").strip()
    client_secret = (settings.google_client_secret or "").strip()
    redirect_uri = (settings.google_redirect_uri or "").strip()
    if not client_id or not client_secret or not redirect_uri:
        raise GoogleDriveNotConfiguredError(
            "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI "
            "precisam estar configurados no .env"
        )
    return client_id, client_secret, redirect_uri


def _client_config(client_id: str, client_secret: str, redirect_uri: str) -> dict:
    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }


def build_auth_url(state: str) -> tuple[str, str, str | None]:
    """Retorna (auth_url, state_efetivo, code_verifier PKCE)."""
    client_id, client_secret, redirect_uri = _require_oauth_client()
    flow = Flow.from_client_config(
        _client_config(client_id, client_secret, redirect_uri),
        scopes=DRIVE_SCOPES,
        state=state,
    )
    flow.redirect_uri = redirect_uri
    auth_url, effective_state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )
    return auth_url, effective_state or state, flow.code_verifier


def exchange_code(code: str, code_verifier: str | None = None) -> Credentials:
    import os

    # Google às vezes devolve scopes em ordem/forma diferente
    os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

    client_id, client_secret, redirect_uri = _require_oauth_client()
    flow = Flow.from_client_config(
        _client_config(client_id, client_secret, redirect_uri),
        scopes=DRIVE_SCOPES,
    )
    flow.redirect_uri = redirect_uri
    if code_verifier:
        flow.code_verifier = code_verifier
    flow.fetch_token(code=code)
    credentials = flow.credentials
    logger.info(
        "OAuth Google concluído: scopes=%s refresh_token_recebido=%s",
        sorted(credentials.scopes or []),
        bool(credentials.refresh_token),
    )
    return credentials


async def save_oauth_state(
    db,
    state: str,
    user_id: str,
    *,
    code_verifier: str | None = None,
) -> None:
    await db.system_settings.update_one(
        {"_id": OAUTH_STATE_ID},
        {
            "$set": {
                "state": state,
                "user_id": user_id,
                "code_verifier": code_verifier,
                "expires_at": datetime.now(UTC) + timedelta(minutes=15),
                "updated_at": datetime.now(UTC),
            }
        },
        upsert=True,
    )


async def consume_oauth_state(db, state: str) -> tuple[str, str | None] | None:
    """Valida e remove o state; retorna (user_id, code_verifier) ou None."""
    doc = await db.system_settings.find_one({"_id": OAUTH_STATE_ID})
    if not doc or doc.get("state") != state:
        return None
    expires = doc.get("expires_at")
    if expires is not None:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < datetime.now(UTC):
            await db.system_settings.delete_one({"_id": OAUTH_STATE_ID})
            return None
    user_id = doc.get("user_id")
    code_verifier = doc.get("code_verifier")
    await db.system_settings.delete_one({"_id": OAUTH_STATE_ID})
    if not user_id:
        return None
    return str(user_id), code_verifier


async def save_connection(
    db,
    credentials: Credentials,
    *,
    connected_by: str | None = None,
) -> dict[str, Any]:
    email = await fetch_google_email(credentials)
    existing = await db.system_settings.find_one({"_id": SETTINGS_ID}) or {}
    payload = {
        "refresh_token": credentials.refresh_token or existing.get("refresh_token"),
        "token": credentials.token,
        "token_expiry": (
            credentials.expiry.isoformat() if credentials.expiry else None
        ),
        "scopes": list(credentials.scopes or DRIVE_SCOPES),
        "google_email": email,
        "folder_id": existing.get("folder_id"),
        "file_ids": existing.get("file_ids") or {},
        "connected_at": datetime.now(UTC),
        "connected_by": connected_by,
        "updated_at": datetime.now(UTC),
    }
    if not payload["refresh_token"]:
        raise GoogleDriveNotConnectedError(
            "Google não retornou refresh_token. Revogue o acesso do app "
            "em https://myaccount.google.com/permissions e conecte de novo."
        )
    await db.system_settings.update_one(
        {"_id": SETTINGS_ID},
        {"$set": payload},
        upsert=True,
    )
    return await get_public_status(db)


async def disconnect(db) -> None:
    await db.system_settings.delete_one({"_id": SETTINGS_ID})
    await db.system_settings.delete_one({"_id": OAUTH_STATE_ID})


async def get_settings_doc(db) -> dict[str, Any] | None:
    return await db.system_settings.find_one({"_id": SETTINGS_ID})


async def get_public_status(db) -> dict[str, Any]:
    doc = await get_settings_doc(db)
    configured = bool(
        (settings.google_client_id or "").strip()
        and (settings.google_client_secret or "").strip()
    )
    if not doc or not doc.get("refresh_token"):
        return {
            "oauth_configured": configured,
            "connected": False,
            "google_email": None,
            "folder_name": settings.google_drive_backup_folder,
            "last_backup_at": None,
            "last_backup_status": None,
            "last_backup_error": None,
            "last_slots_updated": [],
            "slots": {},
            "backup_cron_time": settings.backup_cron_time,
            "enable_backups": settings.enable_backups,
        }

    file_ids = doc.get("file_ids") or {}
    slots = {}
    for slot, filename in SLOT_FILENAMES.items():
        slots[slot] = {
            "filename": filename,
            "file_id": file_ids.get(slot),
            "updated_at": (doc.get("slot_updated_at") or {}).get(slot),
        }

    return {
        "oauth_configured": configured,
        "connected": True,
        "google_email": doc.get("google_email"),
        "folder_name": settings.google_drive_backup_folder,
        "last_backup_at": doc.get("last_backup_at"),
        "last_backup_status": doc.get("last_backup_status"),
        "last_backup_error": doc.get("last_backup_error"),
        "last_slots_updated": doc.get("last_slots_updated") or [],
        "slots": slots,
        "backup_cron_time": settings.backup_cron_time,
        "enable_backups": settings.enable_backups,
    }


def credentials_from_doc(doc: dict[str, Any]) -> Credentials:
    client_id, client_secret, _ = _require_oauth_client()
    refresh_token = doc.get("refresh_token")
    if not refresh_token:
        raise GoogleDriveNotConnectedError("Google Drive não está conectado")
    stored_scopes = set(doc.get("scopes") or [])
    if DRIVE_API_SCOPE not in stored_scopes:
        logger.error(
            "Credencial Google sem o escopo necessário: stored_scopes=%s "
            "required_scope=%s. Reconexão OAuth necessária.",
            sorted(stored_scopes),
            DRIVE_API_SCOPE,
        )
        raise GoogleDriveNotConnectedError(
            "A autorização Google não possui o escopo necessário para acessar "
            "as pastas do Drive. Desconecte e conecte o Google Drive novamente."
        )
    creds = Credentials(
        token=doc.get("token"),
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=doc.get("scopes") or DRIVE_SCOPES,
    )
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            logger.info(
                "Access token Google expirado; iniciando renovação automática "
                "com refresh token."
            )
            try:
                creds.refresh(Request())
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Falha ao renovar automaticamente o token Google: "
                    "tipo=%s mensagem=%s",
                    type(exc).__name__,
                    str(exc),
                )
                raise GoogleDriveNotConnectedError(
                    "O refresh token Google foi rejeitado ou expirou. "
                    "Reconecte o Google Drive."
                ) from exc
            logger.info(
                "Access token Google renovado automaticamente; expira_em=%s",
                creds.expiry.isoformat() if creds.expiry else "desconhecido",
            )
        else:
            logger.error(
                "Credencial Google inválida sem possibilidade de renovação: "
                "expired=%s has_refresh_token=%s",
                creds.expired,
                bool(creds.refresh_token),
            )
            raise GoogleDriveNotConnectedError(
                "Credenciais Google inválidas — reconecte o Drive"
            )
    return creds


async def fetch_google_email(credentials: Credentials) -> str | None:
    try:
        if not credentials.valid and credentials.refresh_token:
            credentials.refresh(Request())
        import requests

        resp = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {credentials.token}"},
            timeout=20,
        )
        if resp.ok:
            return resp.json().get("email")
        logger.warning("userinfo falhou: %s %s", resp.status_code, resp.text[:200])
    except Exception as exc:  # noqa: BLE001
        logger.warning("Não foi possível obter email Google: %s", exc)
    return None


def _drive_service(credentials: Credentials):
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def _ensure_folder(service, folder_path: str) -> str:
    """Cria pasta aninhada (ex.: ControleContas/Backups) e retorna o id final."""
    parent_id = "root"
    for part in [p for p in folder_path.split("/") if p.strip()]:
        query = (
            f"name = '{part}' and mimeType = 'application/vnd.google-apps.folder' "
            f"and '{parent_id}' in parents and trashed = false"
        )
        result = (
            _execute_drive_request(
                service.files().list(
                    q=query,
                    spaces="drive",
                    fields="files(id, name)",
                    pageSize=1,
                ),
                operation=f"listar pasta {part}",
            )
        )
        files = result.get("files") or []
        if files:
            parent_id = files[0]["id"]
            continue
        meta = {
            "name": part,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent_id],
        }
        created = (
            _execute_drive_request(
                service.files().create(body=meta, fields="id"),
                operation=f"criar pasta {part}",
            )
        )
        parent_id = created["id"]
    return parent_id


def upload_or_update_file(
    credentials: Credentials,
    *,
    folder_id: str,
    filename: str,
    local_path: str,
    existing_file_id: str | None = None,
) -> str:
    service = _drive_service(credentials)
    media = MediaFileUpload(
        local_path,
        mimetype="application/gzip",
        resumable=True,
    )
    if existing_file_id:
        try:
            updated = (
                _execute_drive_request(
                    service.files().update(
                        fileId=existing_file_id,
                        media_body=media,
                        fields="id",
                    ),
                    operation=f"atualizar arquivo {filename}",
                )
            )
            return updated["id"]
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Falha ao atualizar arquivo %s (%s): %s — criando novo",
                filename,
                existing_file_id,
                exc,
            )

    meta = {"name": filename, "parents": [folder_id]}
    created = (
        _execute_drive_request(
            service.files().create(body=meta, media_body=media, fields="id"),
            operation=f"criar arquivo {filename}",
        )
    )
    return created["id"]


def prune_folder_to_slots(
    credentials: Credentials,
    *,
    folder_id: str,
    keep_file_ids: set[str],
) -> int:
    """Remove da pasta qualquer arquivo que não seja um dos 3 slots atuais."""
    service = _drive_service(credentials)
    deleted = 0
    page_token = None
    while True:
        result = (
            _execute_drive_request(
                service.files().list(
                    q=f"'{folder_id}' in parents and trashed = false",
                    spaces="drive",
                    fields="nextPageToken, files(id, name)",
                    pageSize=100,
                    pageToken=page_token,
                ),
                operation="listar arquivos da pasta de backup",
            )
        )
        for f in result.get("files") or []:
            fid = f["id"]
            if fid in keep_file_ids:
                continue
            _execute_drive_request(
                service.files().delete(fileId=fid),
                operation=f"excluir arquivo {fid}",
            )
            deleted += 1
        page_token = result.get("nextPageToken")
        if not page_token:
            break
    return deleted


async def ensure_folder_id(db, credentials: Credentials) -> str:
    doc = await get_settings_doc(db) or {}
    folder_id = doc.get("folder_id")
    service = _drive_service(credentials)
    if folder_id:
        try:
            _execute_drive_request(
                service.files().get(fileId=folder_id, fields="id,trashed"),
                operation="validar pasta de backup",
            )
            return folder_id
        except Exception:  # noqa: BLE001
            logger.info("Pasta Drive anterior inválida — recriando")

    folder_id = _ensure_folder(service, settings.google_drive_backup_folder)
    await db.system_settings.update_one(
        {"_id": SETTINGS_ID},
        {"$set": {"folder_id": folder_id, "updated_at": datetime.now(UTC)}},
        upsert=True,
    )
    return folder_id


async def persist_refreshed_token(db, credentials: Credentials) -> None:
    await db.system_settings.update_one(
        {"_id": SETTINGS_ID},
        {
            "$set": {
                "token": credentials.token,
                "token_expiry": (
                    credentials.expiry.isoformat() if credentials.expiry else None
                ),
                "updated_at": datetime.now(UTC),
            }
        },
    )


def frontend_redirect(query: dict[str, str]) -> str:
    base = (settings.frontend_url or "http://localhost:3000").rstrip("/")
    return f"{base}/dashboard/settings?{urlencode(query)}"
