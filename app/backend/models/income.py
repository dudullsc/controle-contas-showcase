from datetime import UTC, datetime
from enum import Enum

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field, GetJsonSchemaHandler
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


class IncomeType(str, Enum):
    FIXED = "FIXED"  # Receita fixa (salário, aluguel recebido, etc)
    # Receita variável (bicos, freelance, comissões, etc)
    VARIABLE = "VARIABLE"


class IncomeBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(..., gt=0)
    income_type: IncomeType
    # Dia do recebimento (para FIXED)
    payment_day: int | None = Field(None, ge=1, le=31)
    # Data completa do recebimento (para VARIABLE)
    payment_date: datetime | None = None
    notes: str | None = None
    is_active: bool = True


class IncomeCreate(IncomeBase):
    user_id: str  # ID do usuário que receberá
    family_id: str  # ID da família para segurança


class IncomeUpdate(BaseModel):
    description: str | None = Field(None, min_length=1, max_length=200)
    amount: float | None = Field(None, gt=0)
    income_type: IncomeType | None = None
    payment_day: int | None = Field(None, ge=1, le=31)
    payment_date: datetime | None = None
    notes: str | None = None
    is_active: bool | None = None


class IncomeInDB(IncomeBase):
    id: PyObjectId | None = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    family_id: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class Income(IncomeBase):
    id: str = Field(alias="_id")
    user_id: str
    family_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)


class IncomeResponse(BaseModel):
    """Response com informações extras do usuário"""

    id: str
    description: str
    amount: float
    income_type: IncomeType
    payment_day: int | None
    payment_date: datetime | None
    notes: str | None
    is_active: bool
    user_id: str
    user_name: str  # Nome do usuário que receberá
    family_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict()
