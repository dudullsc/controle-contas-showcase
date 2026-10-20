from pydantic import BaseModel, ConfigDict, Field


class OwnerTotal(BaseModel):
    """Totais por pessoa - dinâmico para qualquer usuário"""

    owner: str
    full_name: str | None = None  # Nome dinâmico do usuário
    total_expenses: float = 0.0
    total_paid: float = 0.0
    total_pending: float = 0.0
    total_open: float = 0.0
    expense_count: int = 0


class MonthlyTotal(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int
    total_paid: float = 0.0
    total_pending: float = 0.0
    total_open: float = 0.0
    owners: list[OwnerTotal] = []
    total_fixed_income: float = 0.0
    total_variable_income: float = 0.0
    total_income: float = 0.0

    model_config = ConfigDict()


class CategoryTotal(BaseModel):
    category: str
    total: float
    percentage: float
    count: int


class MonthlySummary(BaseModel):
    user_id: str
    month: int
    year: int
    total_expenses: float
    total_paid: float
    total_pending: float
    expenses_by_status: dict[str, float]
    expenses_by_category: list[CategoryTotal]
    expense_count: int
    owners: list[OwnerTotal] = []
    total_fixed_income: float = 0.0
    total_variable_income: float = 0.0
    total_income: float = 0.0


class YearlySummary(BaseModel):
    user_id: str
    year: int
    monthly_totals: list[MonthlyTotal]
    total_year: float
    average_month: float
    owners: list[OwnerTotal] = []
    total_fixed_income: float = 0.0
    total_variable_income: float = 0.0
    total_income: float = 0.0
