from datetime import UTC, datetime
from enum import Enum

from bson import ObjectId
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    GetJsonSchemaHandler,
    field_validator,
    model_validator,
)
from pydantic.json_schema import JsonSchemaValue

from utils.cpf_validator import clean_cpf, validate_cpf
from utils.formatting import format_cpf, format_phone, normalize_phone_for_whatsapp


def utc_now():
    """Return current UTC datetime"""
    return datetime.now(UTC)


class UserRole(str, Enum):
    USER = "USER"
    USERADMIN = "USERADMIN"
    USERADMINSUPER = "USERADMINSUPER"


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


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    cpf: str | None = None
    phone: str | None = None
    is_active: bool = True
    is_admin: bool = False
    whatsapp_notifications_enabled: bool = True
    monthly_salary: float | None = None
    salary_payment_day: int | None = Field(None, ge=1, le=31)

    @field_validator("cpf", mode="before")
    @classmethod
    def clean_cpf_format(cls, v):
        if v is None or v == "":
            return None
        # Sempre remove formatação, independente de validação
        return clean_cpf(v)

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, v):
        if v is None or v == "":
            return None
        # Normaliza telefone para o formato correto (adiciona 55 se necessário)
        normalized = normalize_phone_for_whatsapp(v)
        return normalized if normalized else v


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: UserRole | None = UserRole.USER
    family_id: str | None = None

    @field_validator("cpf")
    @classmethod
    def validate_cpf_on_create(cls, v):
        if v is None or v == "":
            return v
        # Validação rigorosa apenas na criação
        if not validate_cpf(v):
            raise ValueError("CPF inválido")
        return v


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    cpf: str | None = None
    phone: str | None = None
    is_active: bool | None = None
    is_admin: bool | None = None
    whatsapp_notifications_enabled: bool | None = None
    role: UserRole | None = None
    family_id: str | None = None
    current_password: str | None = None
    password: str | None = Field(None, min_length=6)
    monthly_salary: float | None = None
    salary_payment_day: int | None = Field(None, ge=1, le=31)

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone_on_update(cls, v):
        if v is None or v == "":
            return None
        # Normaliza telefone para o formato correto (adiciona 55 se necessário)
        normalized = normalize_phone_for_whatsapp(v)
        return normalized if normalized else v


class UserInDB(UserBase):
    id: PyObjectId | None = Field(default_factory=PyObjectId, alias="_id")
    hashed_password: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )


class User(UserBase):
    id: str = Field(alias="_id")
    created_at: datetime
    role: UserRole = UserRole.USER
    family_id: str | None = None

    @model_validator(mode="after")
    def format_display_fields(self):
        """Formata CPF e telefone para exibição"""
        if self.cpf:
            self.cpf = format_cpf(self.cpf)
        if self.phone:
            self.phone = format_phone(self.phone)
        return self

    model_config = ConfigDict(
        populate_by_name=True,
    )
