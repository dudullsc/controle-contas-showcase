"""Backup do MongoDB com retenção diária/semanal/mensal no Google Drive."""

from __future__ import annotations

import asyncio
import logging
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from config import settings
from services import google_drive as gdrive

logger = logging.getLogger(__name__)

_backup_lock = asyncio.Lock()


class BackupError(Exception):
    """Falha no backup."""


def _slots_to_update(now: datetime, doc: dict[str, Any]) -> list[str]:
    """Sempre daily; weekly na 1ª run da semana ISO; monthly na 1ª do mês."""
    slots = ["daily"]
    iso_year, iso_week, _ = now.isocalendar()
    month_key = f"{now.year}-{now.month:02d}"
    week_key = f"{iso_year}-W{iso_week:02d}"

    last_week = doc.get("last_weekly_key")
    last_month = doc.get("last_monthly_key")

    if last_week != week_key:
        slots.append("weekly")
    if last_month != month_key:
        slots.append("monthly")
    return slots


def _find_mongodump() -> str | None:
    return shutil.which("mongodump")


async def _run_python_dump(archive_path: Path) -> None:
    """Fallback para dev (Windows) sem MongoDB Database Tools."""
    from bson import json_util
    from motor.motor_asyncio import AsyncIOMotorClient

    logger.warning(
        "mongodump ausente — usando dump Python (JSON gzip). "
        "Em produção a imagem Docker inclui mongodump."
    )
    client = AsyncIOMotorClient(settings.mongodb_url)
    try:
        db = client[settings.database_name]
        names = await db.list_collection_names()
        payload = {
            "format": "controle_contas_python_dump_v1",
            "database": settings.database_name,
            "created_at": datetime.now(UTC).isoformat(),
            "collections": {},
        }
        for name in names:
            docs = await db[name].find({}).to_list(length=None)
            payload["collections"][name] = docs

        import gzip

        raw = json_util.dumps(payload).encode("utf-8")
        with gzip.open(archive_path, "wb") as fh:
            fh.write(raw)
    finally:
        client.close()


async def _run_mongodump(archive_path: Path) -> None:
    mongodump = _find_mongodump()
    if not mongodump:
        await _run_python_dump(archive_path)
        return

    uri = settings.mongodb_url
    cmd = [
        mongodump,
        f"--uri={uri}",
        f"--archive={archive_path}",
        "--gzip",
    ]
    logger.info("Executando mongodump → %s", archive_path)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        err = (stderr or stdout or b"").decode("utf-8", errors="replace")
        raise BackupError(f"mongodump falhou (code={proc.returncode}): {err}")


async def run_backup(db, *, triggered_by: str = "scheduler") -> dict[str, Any]:
    """Gera dump e envia aos slots necessários no Drive. Thread-safe."""
    if _backup_lock.locked():
        raise BackupError("Já existe um backup em andamento")

    async with _backup_lock:
        return await _run_backup_locked(db, triggered_by=triggered_by)


async def _run_backup_locked(db, *, triggered_by: str) -> dict[str, Any]:
    now = datetime.now(UTC)
    doc = await gdrive.get_settings_doc(db)
    if not doc or not doc.get("refresh_token"):
        raise gdrive.GoogleDriveNotConnectedError(
            "Conecte o Google Drive em Configurações antes de fazer backup"
        )

    slots = _slots_to_update(now, doc)
    tmp_dir = Path(tempfile.mkdtemp(prefix="controle_contas_backup_"))
    archive_path = tmp_dir / "dump.archive.gz"

    try:
        await _run_mongodump(archive_path)
        if not archive_path.exists() or archive_path.stat().st_size == 0:
            raise BackupError("Arquivo de dump vazio ou ausente")

        credentials = gdrive.credentials_from_doc(doc)
        await gdrive.persist_refreshed_token(db, credentials)
        folder_id = await gdrive.ensure_folder_id(db, credentials)

        file_ids = dict(doc.get("file_ids") or {})
        slot_updated_at = dict(doc.get("slot_updated_at") or {})
        updated_slots: list[str] = []

        for slot in slots:
            filename = gdrive.SLOT_FILENAMES[slot]
            new_id = await asyncio.to_thread(
                gdrive.upload_or_update_file,
                credentials,
                folder_id=folder_id,
                filename=filename,
                local_path=str(archive_path),
                existing_file_id=file_ids.get(slot),
            )
            file_ids[slot] = new_id
            slot_updated_at[slot] = now.isoformat()
            updated_slots.append(slot)

        # Garante os 3 nomes existentes para prune (mesmo se weekly/monthly
        # não rodaram hoje, mantém ids anteriores).
        keep_ids = {fid for fid in file_ids.values() if fid}
        deleted = await asyncio.to_thread(
            gdrive.prune_folder_to_slots,
            credentials,
            folder_id=folder_id,
            keep_file_ids=keep_ids,
        )

        iso_year, iso_week, _ = now.isocalendar()
        update_fields: dict[str, Any] = {
            "file_ids": file_ids,
            "slot_updated_at": slot_updated_at,
            "last_backup_at": now,
            "last_backup_status": "success",
            "last_backup_error": None,
            "last_slots_updated": updated_slots,
            "last_triggered_by": triggered_by,
            "last_deleted_extras": deleted,
            "updated_at": now,
            "token": credentials.token,
        }
        if "weekly" in updated_slots:
            update_fields["last_weekly_key"] = f"{iso_year}-W{iso_week:02d}"
        if "monthly" in updated_slots:
            update_fields["last_monthly_key"] = f"{now.year}-{now.month:02d}"

        await db.system_settings.update_one(
            {"_id": gdrive.SETTINGS_ID},
            {"$set": update_fields},
        )

        size_mb = round(archive_path.stat().st_size / (1024 * 1024), 2)
        result = {
            "status": "success",
            "slots_updated": updated_slots,
            "size_mb": size_mb,
            "deleted_extras": deleted,
            "at": now.isoformat(),
            "triggered_by": triggered_by,
        }
        logger.info("Backup OK: %s", result)
        return result
    except Exception as exc:
        logger.exception("Backup falhou")
        await db.system_settings.update_one(
            {"_id": gdrive.SETTINGS_ID},
            {
                "$set": {
                    "last_backup_at": now,
                    "last_backup_status": "error",
                    "last_backup_error": str(exc),
                    "last_triggered_by": triggered_by,
                    "updated_at": now,
                }
            },
            upsert=True,
        )
        raise
    finally:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:  # noqa: BLE001
            pass


async def scheduled_backup_job() -> None:
    """Entry point do APScheduler."""
    if not settings.enable_backups:
        logger.info("Backups desabilitados (ENABLE_BACKUPS=false)")
        return
    from database import get_database

    try:
        db = await get_database()
        await run_backup(db, triggered_by="scheduler")
    except gdrive.GoogleDriveNotConnectedError as exc:
        logger.warning(
            "Backup agendado pulado: Google Drive não conectado; motivo=%s",
            exc,
        )
    except gdrive.GoogleDriveNotConfiguredError as exc:
        logger.warning(
            "Backup agendado pulado: OAuth Google não configurado; motivo=%s",
            exc,
        )
    except BackupError as exc:
        logger.warning("Backup agendado falhou: %s", exc)
    except Exception:
        logger.exception("Backup agendado com erro inesperado")
