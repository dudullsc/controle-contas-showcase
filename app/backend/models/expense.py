from datetime import UTC, datetime
from enum import Enum

from bson import ObjectId
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    GetJsonSchemaHandler,
    field_validator,
    model_validator,
)
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


class ExpenseStatus(str, Enum):
    PAGO = "PAGO"
    EM_ABERTO = "EM ABERTO"
    NAO_PAGO = "NÃO PAGO"


class PaymentSource(str, Enum):
    SALARY = "SALARY"  # Salário
    CREDIT_CARD = "CREDIT_CARD"  # Cartão de Crédito
    LOAN = "LOAN"  # Empréstimo
    SAVINGS = "SAVINGS"  # Poupança
    OTHER = "OTHER"  # Outro


class ReceiptPublic(BaseModel):
    original_filename: str
    content_type: str
    size_bytes: int
    uploaded_at: datetime
    uploaded_by_name: str | None = None


class ReceiptAmountCheck(BaseModel):
    """Sugestão da IA após upload do comprovante (não persistido)."""

    detected_amount: float
    expense_amount: float
    differs: bool


class ExpenseBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    due_date: datetime
    paid_at: datetime | None = None
    status: ExpenseStatus = ExpenseStatus.EM_ABERTO
    category: str | None = None
    notes: str | None = None
    payment_source: PaymentSource = PaymentSource.SALARY
    credit_card_name: str | None = None
    interest_rate: float | None = Field(None, ge=0, le=100)
    installments: int | None = Field(None, ge=1)
    installment_group_id: str | None = None
    installment_number: int | None = Field(None, ge=1)
    installment_total: int | None = Field(None, ge=1)
    loan_name: str | None = None
    investment_type: str | None = Field(None, max_length=50)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("Valor deve ser maior que zero")
        return round(v, 2)


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    description: str | None = Field(None, min_length=1, max_length=100)
    amount: float | None = Field(None, gt=0)
    due_date: datetime | None = None
    paid_at: datetime | None = None
    status: ExpenseStatus | None = None
    category: str | None = None
    notes: str | None = None
    payment_source: PaymentSource | None = None
    credit_card_name: str | None = None
    interest_rate: float | None = Field(None, ge=0, le=100)
    installments: int | None = Field(None, ge=1)
    installment_group_id: str | None = None
    installment_number: int | None = Field(None, ge=1)
    installment_total: int | None = Field(None, ge=1)
    loan_name: str | None = None
    investment_type: str | None = Field(None, max_length=50)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Valor deve ser maior que zero")
        return round(v, 2) if v else v


class ExpenseInDB(ExpenseBase):
    id: PyObjectId | None = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    family_id: str | None = None
    owner_name: str  # Nome do usuário que criou
    created_by: str
    paid_by_user_id: str | None = None
    paid_by_name: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class Expense(ExpenseBase):
    id: str = Field(alias="_id")
    user_id: str
    family_id: str | None = None
    # Opcional para despesas antigas
    owner_name: str | None = "Desconhecido"
    # Nome dinâmico do usuário (puxado do User)
    full_name: str | None = None
    paid_by_user_id: str | None = None
    paid_by_name: str | None = None
    created_at: datetime
    updated_at: datetime
    has_receipt: bool = False
    receipt: ReceiptPublic | None = None
    receipt_amount_check: ReceiptAmountCheck | None = None

    @model_validator(mode="before")
    @classmethod
    def expose_receipt_public(cls, data):
        if not isinstance(data, dict):
            return data
        receipt = data.get("receipt")
        if isinstance(receipt, dict) and (
            receipt.get("object_key")
            or receipt.get("original_filename")
            or receipt.get("content_type")
        ):
            data["has_receipt"] = True
            data["receipt"] = {
                "original_filename": receipt.get("original_filename") or "comprovante",
                "content_type": receipt.get("content_type")
                or "application/octet-stream",
                "size_bytes": receipt.get("size_bytes") or 0,
                "uploaded_at": receipt.get("uploaded_at") or utc_now(),
                "uploaded_by_name": receipt.get("uploaded_by_name"),
            }
        else:
            data["has_receipt"] = False
            data["receipt"] = None
        return data

    model_config = ConfigDict(
        populate_by_name=True,
    )
