from datetime import UTC, datetime
from enum import Enum

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field


def utc_now():
    """Return current UTC datetime"""
    return datetime.now(UTC)


class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema

        python_schema = core_schema.with_info_before_validator_function(
            cls.validate_from_str,
            core_schema.str_schema(),
        )
        return core_schema.no_info_after_validator_function(
            cls.validate,
            python_schema,
        )

    @classmethod
    def validate_from_str(cls, v, _info):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str):
            if ObjectId.is_valid(v):
                return ObjectId(v)
        raise ValueError("Invalid ObjectId")

    @classmethod
    def validate(cls, v):
        if not isinstance(v, ObjectId):
            raise ValueError("Invalid ObjectId")
        return v


class NotificationType(str, Enum):
    """Tipos de notificações"""

    EXPENSE_5_DAYS_BEFORE = "EXPENSE_5_DAYS_BEFORE"  # 5 dias antes do vencimento
    EXPENSE_1_DAY_BEFORE = "EXPENSE_1_DAY_BEFORE"  # 1 dia antes do vencimento
    EXPENSE_OVERDUE = "EXPENSE_OVERDUE"  # No vencimento e diário enquanto atrasada
    DEBT_5_DAYS_BEFORE = "DEBT_5_DAYS_BEFORE"  # 5 dias antes do vencimento de dívida
    DEBT_1_DAY_BEFORE = "DEBT_1_DAY_BEFORE"  # 1 dia antes do vencimento de dívida
    DEBT_OVERDUE = "DEBT_OVERDUE"  # No vencimento e diário enquanto atrasada


class NotificationStatus(str, Enum):
    """Status da notificação"""

    PENDING = "PENDING"  # Aguardando envio
    SENT = "SENT"  # Enviada com sucesso
    FAILED = "FAILED"  # Falha no envio
    CANCELLED = "CANCELLED"  # Cancelada


class NotificationHistoryBase(BaseModel):
    user_id: str
    notification_type: NotificationType
    related_item_id: str  # ID do expense ou debt
    related_item_type: str  # "expense" ou "debt"
    item_description: str  # Descrição: "Conta de Luz", "Cartão de Crédito"
    amount: float  # Valor
    due_date: datetime  # Data de vencimento
    whatsapp_number: str  # Número do WhatsApp destino
    message_text: str  # Texto da mensagem enviada


class NotificationHistoryCreate(NotificationHistoryBase):
    pass


class NotificationHistoryUpdate(BaseModel):
    status: NotificationStatus | None = None
    error_message: str | None = None


class NotificationHistoryInDB(NotificationHistoryBase):
    id: PyObjectId | None = Field(default_factory=PyObjectId, alias="_id")
    status: NotificationStatus = NotificationStatus.PENDING
    error_message: str | None = None
    sent_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )
