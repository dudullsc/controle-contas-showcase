from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status

from database import get_database
from models.access_log import AccessLogResponse
from models.user import User
from services.access_log_service import AccessLogService
from utils.deps import get_current_super_admin

router = APIRouter(prefix="/admin", tags=["Administração"])


@router.get("/access-logs")
async def get_access_logs(
    user_email: str = None,
    status_filter: str = None,
    start_date: str = None,
    end_date: str = None,
    ip_address: str = None,
    country: str = None,
    city: str = None,
    skip: int = 0,
    limit: int = 50,
    sort_by: str = "timestamp",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_super_admin),
):
    """
    Retorna logs de acesso com filtros.
    Apenas SUPERADMIN tem acesso.

    Filtros disponíveis:
    - user_email: email do usuário (busca parcial)
    - status_filter: SUCCESS, FAILED, INACTIVE_USER, INVALID_CREDENTIALS
    - start_date: data inicial (ISO format: YYYY-MM-DD)
    - end_date: data final (ISO format: YYYY-MM-DD)
    - ip_address: IP exato
    - country: país (busca parcial)
    - city: cidade (busca parcial)
    """
    db = await get_database()
    access_log_service = AccessLogService(db)

    # Converte datas
    start_dt = None
    end_dt = None
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date).replace(
                hour=0, minute=0, second=0, microsecond=0, tzinfo=UTC
            )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="start_date inválida"
            )

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date).replace(
                hour=23, minute=59, second=59, microsecond=999999, tzinfo=UTC
            )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="end_date inválida"
            )

    # Converte sort_order
    sort_order_int = -1 if sort_order == "desc" else 1

    # Busca logs
    logs, total = await access_log_service.get_access_logs(
        user_email=user_email,
        status=status_filter,
        start_date=start_dt,
        end_date=end_dt,
        ip_address=ip_address,
        country=country,
        city=city,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order_int,
    )

    # Converte para response format
    logs_response = [AccessLogResponse.from_db(log) for log in logs]

    return {
        "data": logs_response,
        "total": total,
        "skip": skip,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/access-logs/stats")
async def get_access_stats(
    current_user: User = Depends(get_current_super_admin),
):
    """
    Retorna estatísticas de acesso.
    Apenas SUPERADMIN tem acesso.
    """
    db = await get_database()
    access_log_service = AccessLogService(db)

    stats = await access_log_service.get_access_stats()

    return stats


@router.get("/access-logs/user/{user_id}")
async def get_user_access_logs(
    user_id: str,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_super_admin),
):
    """
    Retorna logs de acesso de um usuário específico.
    Apenas SUPERADMIN tem acesso.
    """
    db = await get_database()
    access_log_service = AccessLogService(db)

    logs, total = await access_log_service.get_user_access_logs(
        user_id=user_id, skip=skip, limit=limit
    )

    logs_response = [AccessLogResponse.from_db(log) for log in logs]

    return {
        "data": logs_response,
        "total": total,
        "skip": skip,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/access-logs/ip/{ip_address}")
async def get_ip_access_logs(
    ip_address: str,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_super_admin),
):
    """
    Retorna logs de acesso de um IP específico.
    Apenas SUPERADMIN tem acesso.
    """
    db = await get_database()
    access_log_service = AccessLogService(db)

    logs, total = await access_log_service.get_access_logs(
        ip_address=ip_address, skip=skip, limit=limit
    )

    logs_response = [AccessLogResponse.from_db(log) for log in logs]

    return {
        "data": logs_response,
        "total": total,
        "skip": skip,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }
