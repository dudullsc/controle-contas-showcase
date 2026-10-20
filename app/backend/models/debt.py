from datetime import UTC, datetime
from enum import Enum

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field, GetJsonSchemaHandler, model_validator
from pydantic.json_schema import JsonSchemaValue


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

    @classmethod
    def __get_pydantic_json_schema__(
        cls, _schema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        return {"type": "string"}


class DebtType(str, Enum):
    CREDIT_CARD = "CREDIT_CARD"  # Cartão de Crédito
    LOAN = "LOAN"  # Empréstimo
    FINANCING = "FINANCING"  # Financiamento
    OVERDRAFT = "OVERDRAFT"  # Cheque Especial


class DebtStatus(str, Enum):
    ACTIVE = "ACTIVE"  # Ativa
    PAID_OFF = "PAID_OFF"  # Quitada
    RENEGOTIATED = "RENEGOTIATED"  # Renegociada


class DebtBase(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Nome da dívida (ex: Cartão Nubank)",
    )
    debt_type: DebtType
    total_amount: float = Field(..., gt=0, description="Valor total da dívida")
    current_balance: float = Field(..., ge=0, description="Saldo atual devedor")
    interest_rate: float = Field(
        ..., ge=0, le=100, description="Taxa de juros mensal (%)"
    )
    minimum_payment: float | None = Field(
        None, ge=0, description="Pagamento mínimo mensal"
    )
    due_day: int = Field(..., ge=1, le=31, description="Dia de vencimento")
    start_date: datetime = Field(
        default_factory=utc_now, description="Data de início da dívida"
    )
    status: DebtStatus = DebtStatus.ACTIVE
    notes: str | None = None

    @model_validator(mode="after")
    def validate_current_balance(self):
        if self.current_balance > self.total_amount:
            raise ValueError("Saldo atual não pode ser maior que o valor total")
        self.current_balance = round(self.current_balance, 2)
        return self


class DebtCreate(DebtBase):
    pass


class DebtUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    debt_type: DebtType | None = None
    total_amount: float | None = Field(None, gt=0)
    current_balance: float | None = Field(None, ge=0)
    interest_rate: float | None = Field(None, ge=0, le=100)
    minimum_payment: float | None = Field(None, ge=0)
    due_day: int | None = Field(None, ge=1, le=31)
    status: DebtStatus | None = None
    notes: str | None = None


class DebtInDB(DebtBase):
    id: PyObjectId | None = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    family_id: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class Debt(DebtBase):
    id: str = Field(alias="_id")
    user_id: str
    family_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
    )


# Modelo para pagamento de dívida


class DebtPayment(BaseModel):
    debt_id: str
    amount: float = Field(..., gt=0)
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    notes: str | None = None


# Modelo para estratégia de pagamento (bola de neve / avalanche)


class PaymentStrategy(str, Enum):
    SNOWBALL = "SNOWBALL"  # Menor saldo primeiro
    AVALANCHE = "AVALANCHE"  # Maior juros primeiro
    CUSTOM = "CUSTOM"  # Personalizado


class DebtPayoffPlan(BaseModel):
    strategy: PaymentStrategy
    monthly_payment: float = Field(
        ..., gt=0, description="Valor mensal disponível para pagar dívidas"
    )
    debts: list[Debt]
    total_debt: float
    total_interest: float
    months_to_payoff: int
    payoff_order: list[str]  # Lista de IDs das dívidas na ordem de pagamento
    monthly_breakdown: list[dict]  # Detalhamento mês a mês
