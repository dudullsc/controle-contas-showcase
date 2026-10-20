from datetime import UTC, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from utils.formatting import format_datetime_short


def utc_now():
    """Return current UTC datetime"""
    return datetime.now(UTC)


class AccessStatus(str, Enum):
    """Status do acesso"""

    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    INACTIVE_USER = "INACTIVE_USER"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"


class AccessLogCreate(BaseModel):
    """Dados para criar um log de acesso"""

    user_email: str
    user_id: str | None = None
    status: AccessStatus
    ip_address: str
    user_agent: str
    country: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    error_message: str | None = None


class AccessLogInDB(AccessLogCreate):
    """Log de acesso no banco de dados"""

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "user_email": "usuario@example.com",
                "user_id": "60d5ec49c1c9c1a8b8c1c1a1",
                "status": "SUCCESS",
                "ip_address": "192.168.1.1",
                "user_agent": "Mozilla/5.0",
                "country": "Brazil",
                "city": "São Paulo",
                "latitude": -23.5505,
                "longitude": -46.6333,
                "error_message": None,
                "timestamp": "2026-02-15T10:30:00Z",
            }
        },
    )

    id: str = Field(alias="_id")
    timestamp: datetime


class AccessLogResponse(BaseModel):
    """Resposta de log de acesso para a API"""

    id: str
    user_email: str
    user_id: str | None = None
    status: str
    ip_address: str
    user_agent: str
    country: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    error_message: str | None = None
    timestamp: str  # Formatado como string

    @classmethod
    def from_db(cls, log_data: dict):
        """Cria a resposta a partir dos dados do banco"""
        return cls(
            id=str(log_data.get("_id")),
            user_email=log_data.get("user_email"),
            user_id=str(log_data.get("user_id")) if log_data.get("user_id") else None,
            status=log_data.get("status"),
            ip_address=log_data.get("ip_address"),
            user_agent=log_data.get("user_agent"),
            country=log_data.get("country"),
            city=log_data.get("city"),
            latitude=log_data.get("latitude"),
            longitude=log_data.get("longitude"),
            error_message=log_data.get("error_message"),
            timestamp=format_datetime_short(log_data.get("timestamp", utc_now())),
        )


class AccessLogFilter(BaseModel):
    """Filtros para listar logs de acesso"""

    user_email: str | None = None
    status: str | None = None
    start_date: str | None = None  # ISO format: YYYY-MM-DD
    end_date: str | None = None  # ISO format: YYYY-MM-DD
    ip_address: str | None = None
    country: str | None = None
    city: str | None = None
    skip: int = Field(0, ge=0)
    limit: int = Field(50, ge=1, le=500)
    sort_by: str = Field("timestamp", pattern="^(timestamp|user_email|status)$")
    sort_order: str = Field("desc", pattern="^(asc|desc)$")
