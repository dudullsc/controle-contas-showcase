from datetime import datetime
from enum import Enum

from pydantic import BaseModel

# ========== ENUMS ==========


class TrendDirection(str, Enum):
    """Direção da tendência financeira"""

    INCREASING = "INCREASING"  # Gastos aumentando
    DECREASING = "DECREASING"  # Gastos diminuindo
    STABLE = "STABLE"  # Estável
    VOLATILE = "VOLATILE"  # Volátil


class FinancialHealth(str, Enum):
    """Status de saúde financeira"""

    EXCELLENT = "EXCELLENT"  # Excelente (positivo e crescendo)
    GOOD = "GOOD"  # Bom (positivo e estável)
    WARNING = "WARNING"  # Atenção (usando crédito moderadamente)
    CRITICAL = "CRITICAL"  # Crítico (dependente de crédito)
    DANGER = "DANGER"  # Perigo (ciclo vicioso de dívidas)


# ========== RENDIMENTOS ==========


class IncomeInfo(BaseModel):
    """Informações de rendimento de um usuário"""

    user_id: str
    user_name: str
    monthly_salary: float  # Mantido para compatibilidade
    fixed_income: float  # Receita fixa total (salário + outras fixas)
    variable_income: float  # Receita variável (bicos, freelance, etc)
    total_income: float  # Total de receitas (fixas + variáveis)
    has_salary_configured: bool  # Mantido para compatibilidade
    has_income_configured: bool  # Se tem alguma receita configurada


class CombinedIncome(BaseModel):
    """Rendimento combinado da família"""

    eduardo_income: IncomeInfo | None = None  # Mantido para compatibilidade
    valeria_income: IncomeInfo | None = None  # Mantido para compatibilidade
    users_income: list[IncomeInfo] = []  # Lista dinâmica de todos os usuários
    total_monthly_income: float  # Mantido para compatibilidade
    total_fixed_income: float  # Total de receitas fixas da família
    total_variable_income: float  # Total de receitas variáveis da família
    total_income: float  # Total geral de receitas
    both_configured: bool  # Mantido para compatibilidade


# ========== ANÁLISE DE FONTES DE PAGAMENTO ==========


class PaymentSourceBreakdown(BaseModel):
    """Análise de como as despesas foram pagas"""

    paid_with_salary: float
    paid_with_salary_percentage: float
    paid_with_credit_card: float
    paid_with_credit_card_percentage: float
    paid_with_loan: float
    paid_with_loan_percentage: float
    paid_with_savings: float
    paid_with_savings_percentage: float
    paid_with_other: float
    paid_with_other_percentage: float
    total_expenses: float
    # % de dependência de crédito (crítico se > 50%)
    credit_dependency_level: float


# ========== ANÁLISE POR USUÁRIO ==========


class UserFinancialSummary(BaseModel):
    """Resumo financeiro individual"""

    user_id: str
    user_name: str
    monthly_salary: float | None  # Mantido para compatibilidade
    fixed_income: float  # Receita fixa
    variable_income: float  # Receita variável
    total_income: float  # Total de receitas
    total_expenses: float  # Despesas pagas com payment_source
    total_all_expenses: float
    total_paid_expenses: float  # Despesas com status PAGO
    total_pending_expenses: float  # Despesas com status EM ABERTO
    total_open_expenses: float  # Despesas com status NÃO PAGO
    payment_breakdown: PaymentSourceBreakdown
    top_categories: list[dict]  # Top 5 categorias
    trend: TrendDirection
    balance: float  # Receitas - Gastos (baseado em total_expenses)
    balance_all_expenses: float  # Receitas - Todas as despesas cadastradas


# ========== COMPARAÇÃO ENTRE USUÁRIOS ==========


class UserComparison(BaseModel):
    """Comparação entre Eduardo e Valeria"""

    eduardo: UserFinancialSummary
    valeria: UserFinancialSummary
    users_summaries: list[UserFinancialSummary] = []
    # Lista dinâmica de todos os usuários
    combined_total: float
    eduardo_percentage: float
    valeria_percentage: float
    biggest_spender: str
    biggest_category_eduardo: str | None
    biggest_category_valeria: str | None


# ========== PROJEÇÕES DE LONGO PRAZO ==========


class MonthlyProjection(BaseModel):
    """Projeção mensal detalhada"""

    month: int
    year: int
    month_number: int  # Número do mês na sequência (1 a 240)
    projected_income: float
    projected_expenses: float
    debt_interest: float
    net_balance: float  # Receita - Despesa - Juros
    accumulated_balance: float  # Saldo acumulado
    is_negative: bool


class YearlyProjection(BaseModel):
    """Projeção anual resumida"""

    year: int
    total_income: float
    total_expenses: float
    total_interest_paid: float
    net_annual: float
    final_balance: float
    months_negative: int
    months_positive: int


class LongTermPrediction(BaseModel):
    """Previsão de longo prazo (1 a 20 anos)"""

    years_projected: int
    start_date: datetime
    end_date: datetime

    # Dados atuais
    current_balance: float
    current_monthly_income: float
    current_monthly_expenses: float
    current_total_debt: float

    # Projeção final
    final_balance: float
    total_income_projected: float
    total_expenses_projected: float
    total_interest_paid: float

    # Análise de períodos negativos/positivos
    will_go_negative: bool
    first_negative_date: datetime | None
    months_in_negative: int
    worst_balance: float
    worst_balance_date: datetime | None

    will_become_positive: bool
    debt_free_date: datetime | None
    months_to_debt_free: int | None

    best_balance: float
    best_balance_date: datetime | None

    # Projeções detalhadas
    yearly_projections: list[YearlyProjection]
    monthly_projections_sample: list[MonthlyProjection]

    warnings: list[str]
    recommendations: list[str]


class PurchaseSimulation(BaseModel):
    """Simulação de compra"""

    purchase_amount: float
    payment_method: str  # SALARY, CREDIT_CARD, LOAN
    installments: int | None = 1
    interest_rate: float | None = 0.0

    # Impacto
    current_balance: float
    balance_after_purchase: float
    impact_percentage: float
    will_go_negative: bool
    months_to_recover: int | None
    recommendation: str


class DebtPayoffSimulation(BaseModel):
    """Simulação de quitação de dívida"""

    extra_monthly_payment: float
    current_payoff_months: int
    new_payoff_months: int
    months_saved: int
    interest_saved: float
    total_paid_current: float
    total_paid_new: float


# ========== DASHBOARD PRINCIPAL ==========


class FinancialDashboard(BaseModel):
    """Dashboard completo de gestão financeira"""

    analysis_date: datetime
    period: str  # Ex: "Dezembro 2024"

    # Status geral
    financial_health: FinancialHealth
    health_score: float  # 0-100

    # Rendimentos
    income: CombinedIncome

    # Análise de pagamentos
    payment_analysis: PaymentSourceBreakdown

    # Comparação entre usuários
    user_comparison: UserComparison

    # Dívidas ativas
    total_active_debts: float
    active_debts_count: int
    monthly_debt_interest: float

    # Previsão de curto prazo (12 meses)
    short_term_balance: float
    short_term_trend: TrendDirection

    # Alertas críticos
    critical_alerts: list[str]

    # Sugestões de melhoria
    suggestions: list[str]
