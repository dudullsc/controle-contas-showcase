"""
Registro de tokens FCM do app mobile.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from database import get_database
from models.user import User
from utils.deps import get_current_active_user

router = APIRouter(prefix="/devices", tags=["Devices / FCM"])


class DeviceTokenIn(BaseModel):
    token: str = Field(..., min_length=10, max_length=512)
    platform: str = Field(default="android")
    app_id: str = Field(default="com.dudullsc.controlecontas")


class DeviceTokenOut(BaseModel):
    ok: bool
    message: str


@router.post("/fcm-token", response_model=DeviceTokenOut)
async def register_fcm_token(
    payload: DeviceTokenIn,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_database),
):
    """Registra/atualiza o token FCM do aparelho para push no app."""
    now = datetime.now(UTC)
    # Evita fan-out: tokens antigos do mesmo user/app (reinstall, refresh)
    # continuavam active e geravam a mesma notificação N vezes.
    await db.device_tokens.update_many(
        {
            "user_id": current_user.id,
            "app_id": payload.app_id,
            "platform": payload.platform,
            "token": {"$ne": payload.token},
            "active": True,
        },
        {"$set": {"active": False, "updated_at": now, "replaced_by": payload.token}},
    )
    await db.device_tokens.update_one(
        {"token": payload.token},
        {
            "$set": {
                "user_id": current_user.id,
                "token": payload.token,
                "platform": payload.platform,
                "app_id": payload.app_id,
                "updated_at": now,
                "active": True,
            },
            "$setOnInsert": {"created_at": now},
            "$unset": {"replaced_by": ""},
        },
        upsert=True,
    )
    return DeviceTokenOut(ok=True, message="Token FCM registrado")


@router.delete("/fcm-token", response_model=DeviceTokenOut)
async def unregister_fcm_token(
    payload: DeviceTokenIn,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_database),
):
    await db.device_tokens.update_one(
        {"token": payload.token, "user_id": current_user.id},
        {"$set": {"active": False, "updated_at": datetime.now(UTC)}},
    )
    return DeviceTokenOut(ok=True, message="Token FCM removido")
