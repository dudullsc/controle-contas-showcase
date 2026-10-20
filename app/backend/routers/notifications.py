"""
Router de Notificações - Endpoints para gerenciar notificações e histórico
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from database import get_database
from models.notification_history import NotificationType
from models.user import User
from utils.deps import get_current_active_user, get_current_super_admin
from utils.formatting import normalize_phone_for_whatsapp

router = APIRouter(prefix="/notifications", tags=["Notificações"])


@router.get("/history")
async def get_notification_history(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_database),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: str = Query(None),
    notification_type: str = Query(None),
):
    """
    Retorna histórico de notificações do usuário
    """
    user_id = current_user.id

    # Constrói filtro
    filter_dict = {"user_id": user_id}

    if status:
        filter_dict["status"] = status

    if notification_type:
        filter_dict["notification_type"] = notification_type

    # Busca notificações
    notifications = (
        await db.notification_history.find(filter_dict)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(None)
    )

    # Contagem total
    total = await db.notification_history.count_documents(filter_dict)

    # Formata resposta
    result = []
    for notif in notifications:
        result.append(
            {
                "id": str(notif.get("_id")),
                "type": notif.get("notification_type"),
                "status": notif.get("status"),
                "item_type": notif.get("related_item_type"),
                "item_description": notif.get("item_description"),
                "amount": notif.get("amount"),
                "due_date": notif.get("due_date").isoformat()
                if notif.get("due_date")
                else None,
                "sent_at": notif.get("sent_at").isoformat()
                if notif.get("sent_at")
                else None,
                "created_at": notif.get("created_at").isoformat()
                if notif.get("created_at")
                else None,
                "error_message": notif.get("error_message"),
            }
        )

    return {"data": result, "total": total, "skip": skip, "limit": limit}


@router.get("/history-stats")
async def get_notification_stats(
    current_user: User = Depends(get_current_active_user), db=Depends(get_database)
):
    """
    Retorna estatísticas de notificações do usuário
    """
    user_id = current_user.id

    # Conta por status
    stats_by_status = {}
    for status in ["PENDING", "SENT", "FAILED", "CANCELLED"]:
        count = await db.notification_history.count_documents(
            {"user_id": user_id, "status": status}
        )
        stats_by_status[status] = count

    # Conta por tipo
    stats_by_type = {}
    for notif_type in NotificationType:
        count = await db.notification_history.count_documents(
            {"user_id": user_id, "notification_type": notif_type.value}
        )
        if count > 0:
            stats_by_type[notif_type.value] = count

    # Total por item type
    stats_by_item = {}
    for item_type in ["expense", "debt"]:
        count = await db.notification_history.count_documents(
            {"user_id": user_id, "related_item_type": item_type}
        )
        stats_by_item[item_type] = count

    return {
        "by_status": stats_by_status,
        "by_type": stats_by_type,
        "by_item_type": stats_by_item,
    }


@router.post("/test-send/{phone}")
async def test_send_notification(
    phone: str, current_user: User = Depends(get_current_active_user)
):
    """
    Envia uma mensagem de teste para um número de WhatsApp
    (Requer autenticação)
    """
    from config import settings as app_settings
    from services.whatsapp_notification import WhatsAppNotificationService

    if not app_settings.waha_api_key:
        raise HTTPException(
            status_code=400, detail="Notificações não estão configuradas"
        )

    # Normaliza número
    phone_clean = normalize_phone_for_whatsapp(phone)
    if not phone_clean:
        raise HTTPException(
            status_code=400,
            detail=f"Número inválido: {phone}. Esperado: (XX) XXXXX-XXXX",
        )

    whatsapp = WhatsAppNotificationService(
        base_url=app_settings.waha_base_url,
        api_key=app_settings.waha_api_key,
        session=app_settings.waha_session,
    )

    # Mensagem de teste
    message = (
        "🧪 *MENSAGEM DE TESTE*\n\n"
        f"Olá {current_user.full_name}!\n"
        "Este é um teste do serviço de notificações de contas.\n\n"
        "Se você recebeu esta mensagem, o sistema está funcionando corretamente! ✅\n\n"
        "Acesse: https://contas.example.com/login"
    )

    success, result = whatsapp.send_text_message(phone_clean, message)

    return {"success": success, "message": result, "phone": phone_clean}


@router.post("/run")
async def run_notifications_now(
    current_user: User = Depends(get_current_super_admin),
):
    """
    Dispara agora a verificação diária de contas (WhatsApp + FCM).
    Mesma lógica do cron das 09:00 — só superadmin.
    """
    from config import settings as app_settings
    from services.fcm_notification import FcmNotificationService, fcm_is_configured
    from services.notification_scheduler import NotificationScheduler
    from services.whatsapp_notification import WhatsAppNotificationService

    if not app_settings.enable_notifications:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notificações desativadas (ENABLE_NOTIFICATIONS=false)",
        )

    db = await get_database()
    whatsapp = None
    waha_warning = None
    fcm_ok = fcm_is_configured()

    if app_settings.waha_api_key:
        candidate = WhatsAppNotificationService(
            base_url=app_settings.waha_base_url,
            api_key=app_settings.waha_api_key,
            session=app_settings.waha_session,
        )
        ok, msg = candidate.test_connection()
        if ok:
            whatsapp = candidate
        else:
            waha_warning = msg
    else:
        waha_warning = "WAHA_API_KEY não configurada"

    if not whatsapp and not fcm_ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Nem WAHA nem FCM estão disponíveis para envio",
        )

    scheduler = NotificationScheduler(db, whatsapp, FcmNotificationService())
    stats = await scheduler.check_and_send_notifications()

    if stats.get("skipped_lock"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um envio de notificações em andamento. Tente novamente em instantes.",
        )

    return {
        "message": "Verificação de notificações concluída",
        "triggered_by": current_user.email,
        "whatsapp_available": whatsapp is not None,
        "fcm_available": fcm_ok,
        "waha_warning": waha_warning if not whatsapp else None,
        **stats,
    }


@router.get("/notification-types")
async def get_notification_types(current_user: User = Depends(get_current_active_user)):
    """
    Retorna lista de tipos de notificações disponíveis
    """
    return {
        "types": [
            {
                "value": notif_type.value,
                "description": notif_type.value.replace("_", " ").title(),
            }
            for notif_type in NotificationType
        ]
    }
