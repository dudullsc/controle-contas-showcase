from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from utils.cpf_validator import clean_cpf, validate_cpf


class FamilyBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    owner_cpf: str = Field(..., description="CPF do responsável (obrigatório)")

    @field_validator("owner_cpf", mode="before")
    @classmethod
    def clean_cpf_format(cls, v):
        if v is None or v == "":
            raise ValueError("CPF obrigatório")
        # Sempre remove formatação, independente de validação
        return clean_cpf(v)


class FamilyCreate(FamilyBase):
    @field_validator("owner_cpf")
    @classmethod
    def validate_cpf_on_create(cls, v):
        if v is None or v == "":
            raise ValueError("CPF obrigatório")
        # Validação rigorosa apenas na criação
        if not validate_cpf(v):
            raise ValueError("CPF inválido")
        return v


class FamilyUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = None
    owner_cpf: str | None = None

    @field_validator("owner_cpf", mode="before")
    @classmethod
    def clean_cpf_format(cls, v):
        if v is None or v == "":
            return None
        return clean_cpf(v)

    @field_validator("owner_cpf")
    @classmethod
    def validate_cpf_on_update(cls, v):
        if v is None or v == "":
            return v
        if not validate_cpf(v):
            raise ValueError("CPF inválido")
        return v


class Family(BaseModel):
    id: str = Field(alias="_id")
    name: str
    description: str | None = None
    owner_cpf: str | None = None  # Opcional na resposta
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(populate_by_name=True)
