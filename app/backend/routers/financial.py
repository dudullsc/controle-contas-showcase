import math
from datetime import UTC, datetime, timedelta

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, Query

from database import get_database
from models.expense import PaymentSource
from models.financial import (
    CombinedIncome,
    FinancialDashboard,
    FinancialHealth,
    IncomeInfo,
    LongTermPrediction,
    MonthlyProjection,
    PaymentSourceBreakdown,
    PurchaseSimulation,
    TrendDirection,
    UserComparison,
    UserFinancialSummary,
    YearlyProjection,
)
from models.user import User
from utils.deps import get_current_active_user
from utils.formatting import format_currency_br

router = APIRouter(prefix="/financial", tags=["Análise Financeira"])

# ========== FUNÇÕES AUXILIARES ==========


def calculate_trend(values: list[float]) -> TrendDirection:
    """Calcula tendência usando regressão linear"""
    if len(values) < 2:
        return TrendDirection.STABLE

    n = len(values)
    x = list(range(n))
    x_mean = sum(x) / n
    y_mean = sum(values) / n

    numerator = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
    denominator = sum((x[i] - x_mean) ** 2 for i in range(n))

    if denominator == 0:
        return TrendDirection.STABLE

    slope = numerator / denominator
    std_dev = math.sqrt(sum((values[i] - y_mean) ** 2 for i in range(n)) / n)
    coefficient_of_variation = std_dev / y_mean if y_mean != 0 else 0

    if coefficient_of_variation > 0.3:
        return TrendDirection.VOLATILE
    elif slope > 0.05 * y_mean:
        return TrendDirection.INCREASING
    elif slope < -0.05 * y_mean:
        return TrendDirection.DECREASING
    else:
        return TrendDirection.STABLE


async def get_user_income(db, user_id: str, family_id: str):
    """Busca informação de salário do usuário (validando family_id)"""
    from bson import ObjectId

    user = await db.users.find_one(
        {
            "_id": ObjectId(user_id),
            "family_id": family_id,  # Validação de segurança
        }
    )
    if user:
        return user.get("monthly_salary"), user.get("full_name")
    return None, None


async def get_user_incomes_from_db(db, user_id: str, family_id: str):
    """Busca todas as receitas ativas de um usuário"""
    query = {"user_id": user_id, "is_active": True}

    # Se family_id é fornecido, filtra por ele
    if family_id:
        query["family_id"] = family_id

    incomes = await db.incomes.find(query).to_list(length=None)

    fixed_income = sum(
        inc["amount"] for inc in incomes if inc["income_type"] == "FIXED"
    )
    variable_income = sum(
        inc["amount"] for inc in incomes if inc["income_type"] == "VARIABLE"
    )

    return fixed_income, variable_income, len(incomes) > 0


async def get_all_active_users(db, family_id: str):
    """Busca usuários ativos da família (ou todos se family_id for
    None para superadmin)."""
    query = {"is_active": True}

    # Se family_id é fornecido, filtra por ele
    # Se é None (superadmin), busca todos os usuários
    if family_id:
        query["family_id"] = family_id
        users = await db.users.find(query).to_list(length=None)
        # Filtro adicional para garantir que todos têm family_id definido
        users = [u for u in users if u.get("family_id") == family_id]
    else:
        # Superadmin: busca todos os usuários ativos
        users = await db.users.find(query).to_list(length=None)

    return users


def find_user_by_name_pattern(users: list[dict], pattern: str) -> dict | None:
    """Encontra usuário por padrão no nome (case-insensitive)"""
    pattern_lower = pattern.lower()
    for user in users:
        full_name = user.get("full_name", "").lower()
        if pattern_lower in full_name:
            return user
    return None


# ========== DASHBOARD PRINCIPAL ==========


@router.get("/dashboard", response_model=FinancialDashboard)
async def get_financial_dashboard(
    month: int = Query(None, ge=1, le=12),
    year: int = Query(None, ge=2000),
    current_user: User = Depends(get_current_active_user),
):
    """Dashboard completo de gestão financeira"""
    db = await get_database()

    try:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)

        # Construir query de filtro por família
        # Se superadmin (family_id = None), busca TUDO
        # Caso contrário, filtra pela família do usuário
        if current_user.family_id is None:
            family_filter = {}
        else:
            family_filter = {"family_id": current_user.family_id}

        # Buscar despesas do período
        expenses = await db.expenses.find(
            {**family_filter, "due_date": {"$gte": start_date, "$lt": end_date}}
        ).to_list(length=None)

        # Análise de fontes de pagamento
        # Filtra somente status PAGO com payment_source definido
        paid_expenses = [
            e for e in expenses if e.get("status") == "PAGO" and e.get("payment_source")
        ]

        total_expenses = sum(e.get("amount", 0) for e in paid_expenses)
        paid_salary = sum(
            e.get("amount", 0)
            for e in paid_expenses
            if e.get("payment_source") == PaymentSource.SALARY
        )
        paid_credit = sum(
            e.get("amount", 0)
            for e in paid_expenses
            if e.get("payment_source") == PaymentSource.CREDIT_CARD
        )
        paid_loan = sum(
            e.get("amount", 0)
            for e in paid_expenses
            if e.get("payment_source") == PaymentSource.LOAN
        )
        paid_savings = sum(
            e.get("amount", 0)
            for e in paid_expenses
            if e.get("payment_source") == PaymentSource.SAVINGS
        )
        paid_other = sum(
            e.get("amount", 0)
            for e in paid_expenses
            if e.get("payment_source") == PaymentSource.OTHER
        )

        payment_analysis = PaymentSourceBreakdown(
            paid_with_salary=round(paid_salary, 2),
            paid_with_salary_percentage=round(
                (paid_salary / total_expenses * 100) if total_expenses > 0 else 0,
                2,
            ),
            paid_with_credit_card=round(paid_credit, 2),
            paid_with_credit_card_percentage=round(
                (paid_credit / total_expenses * 100) if total_expenses > 0 else 0,
                2,
            ),
            paid_with_loan=round(paid_loan, 2),
            paid_with_loan_percentage=round(
                (paid_loan / total_expenses * 100) if total_expenses > 0 else 0,
                2,
            ),
            paid_with_savings=round(paid_savings, 2),
            paid_with_savings_percentage=round(
                (paid_savings / total_expenses * 100) if total_expenses > 0 else 0,
                2,
            ),
            paid_with_other=round(paid_other, 2),
            paid_with_other_percentage=round(
                (paid_other / total_expenses * 100) if total_expenses > 0 else 0,
                2,
            ),
            total_expenses=round(total_expenses, 2),
            credit_dependency_level=round(
                ((paid_credit + paid_loan) / total_expenses * 100)
                if total_expenses > 0
                else 0,
                2,
            ),
        )
    except Exception as e:
        import logging

        logging.exception("Erro no dashboard financeiro:")
        from fastapi import HTTPException

        raise HTTPException(
            status_code=500, detail=f"Erro interno no dashboard financeiro: {str(e)}"
        )

    # Buscar rendimentos de todos os usuários ativos da família
    # Ordena por nome para manter consistência (primeiro usuário = primeiro,
    # segundo = segundo)
    all_users = await get_all_active_users(db, current_user.family_id)
    sorted_users = sorted(all_users, key=lambda u: u.get("full_name", "").lower())

    # Limita a 2 usuários principais (compatibilidade com modelo atual)
    user_incomes = []
    all_user_incomes = []  # Lista completa de todos os usuários
    total_fixed = 0
    total_variable = 0

    for user in sorted_users:
        user_id = str(user["_id"])
        salary = user.get("monthly_salary", 0) or 0

        # Buscar receitas do novo sistema
        fixed_income, variable_income, has_incomes = await get_user_incomes_from_db(
            db, user_id, current_user.family_id
        )

        # Se tem salário antigo mas não tem receitas,
        # usar o salário como receita fixa
        if salary > 0 and not has_incomes:
            fixed_income = salary

        total_income_user = fixed_income + variable_income

        income_info = IncomeInfo(
            user_id=user_id,
            user_name=user.get("full_name", "Usuário"),
            monthly_salary=salary,  # Mantém compatibilidade
            fixed_income=fixed_income,
            variable_income=variable_income,
            total_income=total_income_user,
            has_salary_configured=salary > 0,  # Mantém compatibilidade
            has_income_configured=(fixed_income + variable_income) > 0,
        )
        all_user_incomes.append(income_info)
        total_fixed += fixed_income
        total_variable += variable_income

        # Mantém os 2 primeiros para compatibilidade
        if len(user_incomes) < 2:
            user_incomes.append(income_info)

    # Manter compatibilidade com modelo atual (eduardo_income, valeria_income)
    eduardo_income = user_incomes[0] if len(user_incomes) > 0 else None
    valeria_income = user_incomes[1] if len(user_incomes) > 1 else None

    total_income = total_fixed + total_variable

    income = CombinedIncome(
        eduardo_income=eduardo_income,
        valeria_income=valeria_income,
        users_income=all_user_incomes,  # Lista completa
        total_monthly_income=total_income,  # Mantém compatibilidade
        total_fixed_income=total_fixed,
        total_variable_income=total_variable,
        total_income=total_income,
        both_configured=(
            len([inc for inc in all_user_incomes if inc.has_income_configured]) >= 2
        ),
    )

    # Análise por usuário
    async def get_user_summary(
        user_id: str,
        user_name: str,
        salary: float | None,
        fixed_income: float,
        variable_income: float,
        total_income: float,
    ) -> UserFinancialSummary:
        # Filtrar despesas do usuário
        user_expenses = [e for e in expenses if e.get("user_id") == user_id]
        # Todas as despesas cadastradas (independente do status)
        user_all_expenses_total = sum(e.get("amount", 0) for e in user_expenses)
        # Despesas por status
        user_paid_expenses_list = [
            e for e in user_expenses if e.get("status") == "PAGO"
        ]
        user_pending_expenses_list = [
            e for e in user_expenses if e.get("status") == "EM ABERTO"
        ]
        user_open_expenses_list = [
            e for e in user_expenses if e.get("status") == "NÃO PAGO"
        ]

        user_paid_total = sum(e.get("amount", 0) for e in user_paid_expenses_list)
        user_pending_total = sum(e.get("amount", 0) for e in user_pending_expenses_list)
        user_open_total = sum(e.get("amount", 0) for e in user_open_expenses_list)

        # Apenas despesas PAGAS com payment_source
        user_paid_expenses = [
            e for e in user_paid_expenses_list if e.get("payment_source")
        ]
        user_total = sum(e.get("amount", 0) for e in user_paid_expenses)

        user_paid_salary = sum(
            e.get("amount", 0)
            for e in user_paid_expenses
            if e.get("payment_source") == PaymentSource.SALARY
        )
        user_paid_credit = sum(
            e.get("amount", 0)
            for e in user_paid_expenses
            if e.get("payment_source") == PaymentSource.CREDIT_CARD
        )
        user_paid_loan = sum(
            e.get("amount", 0)
            for e in user_paid_expenses
            if e.get("payment_source") == PaymentSource.LOAN
        )
        user_paid_savings = sum(
            e.get("amount", 0)
            for e in user_paid_expenses
            if e.get("payment_source") == PaymentSource.SAVINGS
        )
        user_paid_other = sum(
            e.get("amount", 0)
            for e in user_paid_expenses
            if e.get("payment_source") == PaymentSource.OTHER
        )

        user_payment_breakdown = PaymentSourceBreakdown(
            paid_with_salary=round(user_paid_salary, 2),
            paid_with_salary_percentage=round(
                (user_paid_salary / user_total * 100) if user_total > 0 else 0,
                2,
            ),
            paid_with_credit_card=round(user_paid_credit, 2),
            paid_with_credit_card_percentage=round(
                (user_paid_credit / user_total * 100) if user_total > 0 else 0,
                2,
            ),
            paid_with_loan=round(user_paid_loan, 2),
            paid_with_loan_percentage=round(
                (user_paid_loan / user_total * 100) if user_total > 0 else 0,
                2,
            ),
            paid_with_savings=round(user_paid_savings, 2),
            paid_with_savings_percentage=round(
                (user_paid_savings / user_total * 100) if user_total > 0 else 0,
                2,
            ),
            paid_with_other=round(user_paid_other, 2),
            paid_with_other_percentage=round(
                (user_paid_other / user_total * 100) if user_total > 0 else 0,
                2,
            ),
            total_expenses=round(user_total, 2),
            credit_dependency_level=round(
                ((user_paid_credit + user_paid_loan) / user_total * 100)
                if user_total > 0
                else 0,
                2,
            ),
        )

        # Top categorias
        categories = {}
        for e in user_expenses:
            cat = e.get("category", "Sem categoria")
            categories[cat] = categories.get(cat, 0) + e.get("amount", 0)

        top_categories = [
            {"category": k, "total": round(v, 2)}
            for k, v in sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]
        ]

        # Tendência (usar histórico de 6 meses)
        trend = TrendDirection.STABLE

        # Calcular balance com receitas totais
        balance = total_income - user_total
        # Calcular balance considerando todas as despesas cadastradas
        balance_all_expenses = total_income - user_all_expenses_total

        return UserFinancialSummary(
            user_id=user_id,
            user_name=user_name,
            monthly_salary=salary,  # Mantém compatibilidade
            fixed_income=round(fixed_income, 2),
            variable_income=round(variable_income, 2),
            total_income=round(total_income, 2),
            total_expenses=round(user_total, 2),
            total_all_expenses=round(user_all_expenses_total, 2),
            total_paid_expenses=round(user_paid_total, 2),
            total_pending_expenses=round(user_pending_total, 2),
            total_open_expenses=round(user_open_total, 2),
            payment_breakdown=user_payment_breakdown,
            top_categories=top_categories,
            trend=trend,
            balance=round(balance, 2),
            balance_all_expenses=round(balance_all_expenses, 2),
        )

    # Criar summaries para os usuários (limita a 2 para compatibilidade)
    user_summaries = []
    all_user_summaries = []  # Lista completa de todos os usuários
    for user_income in all_user_incomes:
        user = next(
            (u for u in sorted_users if str(u["_id"]) == user_income.user_id), None
        )
        if user:
            summary = await get_user_summary(
                user_income.user_id,
                user_income.user_name,
                user_income.monthly_salary,
                user_income.fixed_income,
                user_income.variable_income,
                user_income.total_income,
            )
            all_user_summaries.append(summary)
            # Mantém os 2 primeiros para compatibilidade
            if len(user_summaries) < 2:
                user_summaries.append(summary)

    # Manter compatibilidade com modelo (eduardo_summary, valeria_summary)
    eduardo_summary = user_summaries[0] if len(user_summaries) > 0 else None
    valeria_summary = user_summaries[1] if len(user_summaries) > 1 else None

    # Comparação
    combined_total = sum(s.total_expenses for s in all_user_summaries)
    eduardo_pct = (
        (eduardo_summary.total_expenses / combined_total * 100)
        if combined_total > 0 and eduardo_summary
        else 0
    )
    valeria_pct = (
        (valeria_summary.total_expenses / combined_total * 100)
        if combined_total > 0 and valeria_summary
        else 0
    )

    eduardo_top_cat = (
        eduardo_summary.top_categories[0]["category"]
        if eduardo_summary and eduardo_summary.top_categories
        else None
    )
    valeria_top_cat = (
        valeria_summary.top_categories[0]["category"]
        if valeria_summary and valeria_summary.top_categories
        else None
    )

    # Encontrar maior gastador dinamicamente
    if all_user_summaries:
        biggest_spender = max(
            all_user_summaries, key=lambda s: s.total_expenses
        ).user_name
    else:
        biggest_spender = "N/A"

    user_comparison = UserComparison(
        eduardo=eduardo_summary
        or UserFinancialSummary(
            user_id="",
            user_name="",
            monthly_salary=0,
            fixed_income=0,
            variable_income=0,
            total_income=0,
            total_expenses=0,
            payment_breakdown=PaymentSourceBreakdown(
                paid_with_salary=0,
                paid_with_salary_percentage=0,
                paid_with_credit_card=0,
                paid_with_credit_card_percentage=0,
                paid_with_loan=0,
                paid_with_loan_percentage=0,
                paid_with_savings=0,
                paid_with_savings_percentage=0,
                paid_with_other=0,
                paid_with_other_percentage=0,
                total_expenses=0,
                credit_dependency_level=0,
            ),
            top_categories=[],
            trend=TrendDirection.STABLE,
            balance=0,
        ),
        valeria=valeria_summary
        or UserFinancialSummary(
            user_id="",
            user_name="",
            monthly_salary=0,
            fixed_income=0,
            variable_income=0,
            total_income=0,
            total_expenses=0,
            total_all_expenses=0,
            total_paid_expenses=0,
            total_pending_expenses=0,
            total_open_expenses=0,
            payment_breakdown=PaymentSourceBreakdown(
                paid_with_salary=0,
                paid_with_salary_percentage=0,
                paid_with_credit_card=0,
                paid_with_credit_card_percentage=0,
                paid_with_loan=0,
                paid_with_loan_percentage=0,
                paid_with_savings=0,
                paid_with_savings_percentage=0,
                paid_with_other=0,
                paid_with_other_percentage=0,
                total_expenses=0,
                credit_dependency_level=0,
            ),
            top_categories=[],
            trend=TrendDirection.STABLE,
            balance=0,
            balance_all_expenses=0,
        ),
        # Lista completa de todos os usuários
        users_summaries=all_user_summaries,
        combined_total=round(combined_total, 2),
        eduardo_percentage=round(eduardo_pct, 2),
        valeria_percentage=round(valeria_pct, 2),
        biggest_spender=biggest_spender,
        biggest_category_eduardo=eduardo_top_cat,
        biggest_category_valeria=valeria_top_cat,
    )

    # Dívidas ativas (otimizado com aggregation)
    if current_user.family_id is None:
        debt_match = {}
    else:
        debt_match = {"family_id": current_user.family_id}
    debt_pipeline = [
        {"$match": {**debt_match, "status": "ACTIVE"}},
        {
            "$group": {
                "_id": None,
                "total_debt": {"$sum": "$current_balance"},
                "monthly_interest": {
                    "$sum": {
                        "$multiply": [
                            "$current_balance",
                            {"$divide": ["$interest_rate", 100]},
                        ]
                    }
                },
                "count": {"$sum": 1},
            }
        },
    ]
    debt_result = await db.debts.aggregate(debt_pipeline).to_list(length=1)
    total_debt = debt_result[0]["total_debt"] if debt_result else 0
    monthly_interest = debt_result[0]["monthly_interest"] if debt_result else 0
    debt_count = debt_result[0]["count"] if debt_result else 0

    # Saúde financeira
    credit_dependency = payment_analysis.credit_dependency_level

    if credit_dependency > 70:
        financial_health = FinancialHealth.DANGER
        health_score = 20
    elif credit_dependency > 50:
        financial_health = FinancialHealth.CRITICAL
        health_score = 40
    elif credit_dependency > 30:
        financial_health = FinancialHealth.WARNING
        health_score = 60
    elif total_income > total_expenses:
        financial_health = FinancialHealth.GOOD
        health_score = 80
    else:
        financial_health = FinancialHealth.EXCELLENT
        health_score = 95

    # Alertas
    critical_alerts = []
    if credit_dependency > 50:
        critical_alerts.append(
            f"⚠️ {credit_dependency:.1f}% das despesas são pagas com crédito/empréstimo!"
        )
    if total_debt > total_income * 3:
        critical_alerts.append(
            f"⚠️ Dívida total ({total_debt:.2f}) é maior que 3x sua renda mensal!"
        )
    if not income.both_configured:
        critical_alerts.append(
            "⚠️ Configure as receitas de ambos os usuários para análises precisas"
        )

    # Sugestões
    suggestions = []
    if credit_dependency > 30:
        suggestions.append(
            "💡 Priorize pagar com salário ao invés de cartão de crédito"
        )
    if total_debt > 0:
        suggestions.append(
            "💡 Acesse a seção de Dívidas para ver estratégia de pagamento otimizada"
        )
    if total_expenses > total_income:
        expenses_formatted = format_currency_br(total_expenses)
        income_formatted = format_currency_br(total_income)
        diff_formatted = format_currency_br(total_expenses - total_income)
        suggestions.append(
            "💡 Gastos (R$ "
            f"{expenses_formatted}) excedem renda (R$ {income_formatted}) "
            f"em R$ {diff_formatted}"
        )

    return FinancialDashboard(
        analysis_date=datetime.now(UTC),
        period=f"{start_date.strftime('%B %Y')}",
        financial_health=financial_health,
        health_score=health_score,
        income=income,
        payment_analysis=payment_analysis,
        user_comparison=user_comparison,
        total_active_debts=round(total_debt, 2),
        active_debts_count=debt_count,
        monthly_debt_interest=round(monthly_interest, 2),
        short_term_balance=round(total_income - total_expenses, 2),
        short_term_trend=TrendDirection.STABLE,
        critical_alerts=critical_alerts,
        suggestions=suggestions,
    )


# ========== PREVISÕES DE LONGO PRAZO (1-20 ANOS) ==========


@router.get("/long-term-prediction", response_model=LongTermPrediction)
async def get_long_term_prediction(
    years: int = Query(
        5,
        ge=1,
        le=20,
        description="Anos para projetar (1-20)",
    ),
    current_balance: float = Query(
        0.0,
        description="Saldo atual",
    ),
    inflation_rate: float = Query(
        0.05,
        ge=0,
        le=1,
        description="Taxa de inflação anual (0.05 = 5%)",
    ),
    monthly_income: float | None = Query(
        None,
        description="Renda mensal a ser usada na projeção (opcional)",
    ),
    monthly_expenses: float | None = Query(
        None,
        description="Despesas mensais a serem usadas na projeção (opcional)",
    ),
    current_user: User = Depends(get_current_active_user),
):
    """
    Previsão financeira de longo prazo (1-20 anos)

    Calcula projeções mensais e anuais baseadas em:
    - Renda mensal atual (soma dos salários configurados)
    - Média de despesas dos últimos 6 meses
    - Dívidas ativas e juros
    - Taxa de inflação

    Args:
        years: Número de anos para projetar
        current_balance: Saldo atual (se não informado, calcula automático)
        inflation_rate: Taxa de inflação anual (padrão: 5%)
        current_user: Usuário autenticado

    Returns:
        LongTermPrediction com projeções, avisos e recomendações
    """
    """Previsão financeira de longo prazo (1 a 20 anos)"""
    db = await get_database()

    # Usar valores fornecidos se existirem, senão calcular normalmente
    if monthly_income is not None:
        used_monthly_income = monthly_income
    else:
        # Buscar rendimentos da família do usuário
        if current_user.family_id is None:
            user_query = {}
        else:
            user_query = {"family_id": current_user.family_id}
        all_users = await db.users.find(user_query).to_list(length=None)  # noqa: E501

        used_monthly_income = 0
        for user in all_users:
            user_id = str(user["_id"])
            salary = user.get("monthly_salary", 0) or 0

            fixed_income, variable_income, has_incomes = await get_user_incomes_from_db(
                db, user_id, current_user.family_id
            )

            # Se só existe salário legado, considere como receita fixa
            if salary > 0 and not has_incomes:
                fixed_income = salary

            used_monthly_income += fixed_income + variable_income
    # Garante que não seja None
    if used_monthly_income is None:
        used_monthly_income = 0

    # Calcular média mensal de gastos (últimos 6 meses)
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    expense_query = {"due_date": {"$gte": six_months_ago}}
    if current_user.family_id is not None:
        expense_query["family_id"] = current_user.family_id
    recent_expenses = await db.expenses.find(expense_query).to_list(length=None)

    if recent_expenses:
        used_monthly_expenses = sum(e.get("amount", 0) for e in recent_expenses) / 6
    else:
        used_monthly_expenses = 0
    # Garante que não seja None
    if used_monthly_expenses is None:
        used_monthly_expenses = 0

    # Buscar dívidas ativas
    debt_query = {"status": "ACTIVE"}
    if current_user.family_id is not None:
        debt_query["family_id"] = current_user.family_id
    debts = await db.debts.find(debt_query).to_list(length=None)
    total_debt = sum(d.get("current_balance", 0) for d in debts)
    avg_debt_interest = (
        sum(d.get("interest_rate", 0) for d in debts) / len(debts) if debts else 0
    )

    # Simulação mês a mês
    total_months = years * 12
    all_monthly_projections = []
    balance = current_balance

    total_income_projected = 0
    total_expenses_projected = 0
    total_interest_paid = 0

    worst_balance = balance
    worst_balance_date = None
    best_balance = balance
    best_balance_date = None

    first_negative_date = None
    debt_free_date = None
    months_negative = 0

    for month_num in range(1, total_months + 1):
        current_date = datetime.now(UTC) + relativedelta(months=month_num)
        year = current_date.year
        month = current_date.month

        # NÃO aplicar inflação em nada: tudo fixo
        projected_income = used_monthly_income
        projected_expenses = used_monthly_expenses

        # Juros da dívida
        # Assume pagamento de 500/mês
        remaining_debt = max(0, total_debt - (month_num * 500))
        debt_interest = remaining_debt * (avg_debt_interest / 100)

        net_balance = projected_income - projected_expenses - debt_interest
        balance += net_balance

        total_income_projected += projected_income
        total_expenses_projected += projected_expenses
        total_interest_paid += debt_interest

        is_negative = balance < 0

        if is_negative:
            months_negative += 1
            if first_negative_date is None:
                first_negative_date = current_date

        if balance < worst_balance:
            worst_balance = balance
            worst_balance_date = current_date

        if balance > best_balance:
            best_balance = balance
            best_balance_date = current_date

        if remaining_debt == 0 and debt_free_date is None and total_debt > 0:
            debt_free_date = current_date

        projection = MonthlyProjection(
            month=month,
            year=year,
            month_number=month_num,
            projected_income=round(projected_income, 2),
            projected_expenses=round(projected_expenses, 2),
            debt_interest=round(debt_interest, 2),
            net_balance=round(net_balance, 2),
            accumulated_balance=round(balance, 2),
            is_negative=is_negative,
        )

        all_monthly_projections.append(projection)

        # Mantemos todos os meses para exibir todo o período projetado no frontend.

    # Projeções anuais
    yearly_projections = []
    for y in range(1, years + 1):
        year_start = (y - 1) * 12 + 1
        year_end = y * 12
        year_months = [
            p
            for p in all_monthly_projections
            if year_start <= p.month_number <= year_end
        ]

        if not year_months:
            continue

        year_income = sum(p.projected_income for p in year_months)
        year_expenses = sum(p.projected_expenses for p in year_months)
        year_interest = sum(p.debt_interest for p in year_months)
        year_net = year_income - year_expenses - year_interest
        year_final_balance = year_months[-1].accumulated_balance if year_months else 0
        year_negative = sum(1 for p in year_months if p.is_negative)
        year_positive = len(year_months) - year_negative

        yearly_projections.append(
            YearlyProjection(
                year=datetime.now(UTC).year + y,
                total_income=round(year_income, 2),
                total_expenses=round(year_expenses, 2),
                total_interest_paid=round(year_interest, 2),
                net_annual=round(year_net, 2),
                final_balance=round(year_final_balance, 2),
                months_negative=year_negative,
                months_positive=year_positive,
            )
        )

    # Alertas e recomendações
    warnings = []
    recommendations = []

    if first_negative_date:
        warnings.append(
            f"⚠️ Saldo ficará negativo em {first_negative_date.strftime('%m/%Y')}"
        )
    if worst_balance < -used_monthly_income * 3:
        worst_date = (
            worst_balance_date.strftime("%m/%Y") if worst_balance_date else "N/A"
        )
        warnings.append(
            f"⚠️ Pior saldo projetado: R$ {worst_balance:.2f} em {worst_date}"
        )
    if months_negative > total_months * 0.5:
        warnings.append(
            "⚠️ Ficará negativo por "
            f"{months_negative} de {total_months} meses ("
            f"{months_negative / total_months * 100:.1f}%"
            ")"
        )

    if balance > current_balance:
        recommendations.append(
            f"✅ Saldo crescerá R$ {balance - current_balance:.2f} em {years} anos"
        )
    if debt_free_date:
        recommendations.append(
            f"✅ Previsão de ficar livre de dívidas: {debt_free_date.strftime('%m/%Y')}"
        )
    else:
        recommendations.append(
            "💡 Aumente o pagamento mensal das dívidas para quitá-las mais rápido"
        )

    # total projetada para ser exatamente o valor mensal × 12 × anos
    total_income_projected = used_monthly_income * 12 * years
    return LongTermPrediction(
        years_projected=years,
        start_date=datetime.utcnow(),
        end_date=datetime.utcnow() + relativedelta(years=years),
        current_balance=current_balance,
        current_monthly_income=used_monthly_income,
        current_monthly_expenses=used_monthly_expenses,
        current_total_debt=total_debt,
        final_balance=round(balance, 2),
        total_income_projected=round(total_income_projected, 2),
        total_expenses_projected=round(total_expenses_projected, 2),
        total_interest_paid=round(total_interest_paid, 2),
        will_go_negative=first_negative_date is not None,
        first_negative_date=first_negative_date,
        months_in_negative=months_negative,
        worst_balance=round(worst_balance, 2),
        worst_balance_date=worst_balance_date,
        will_become_positive=balance >= 0 if first_negative_date else True,
        debt_free_date=debt_free_date,
        months_to_debt_free=((debt_free_date - datetime.now(UTC)).days // 30)
        if debt_free_date
        else None,
        best_balance=round(best_balance, 2),
        best_balance_date=best_balance_date,
        yearly_projections=yearly_projections,
        monthly_projections_sample=all_monthly_projections,
        warnings=warnings,
        recommendations=recommendations,
    )


# ========== SIMULADORES ==========


@router.post("/simulate-purchase", response_model=PurchaseSimulation)
async def simulate_purchase(
    amount: float = Query(..., gt=0),
    payment_method: PaymentSource = Query(...),
    installments: int = Query(1, ge=1),
    interest_rate: float = Query(0, ge=0, le=100),
    current_user: User = Depends(get_current_active_user),
):
    """Simula impacto de uma compra"""
    db = await get_database()

    # Buscar saldo atual de todos os usuários ativos da família
    all_users = await get_all_active_users(db, current_user.family_id)

    monthly_income = 0
    for user in all_users:
        user_id = str(user["_id"])
        salary = user.get("monthly_salary", 0) or 0

        fixed_income, variable_income, has_incomes = await get_user_incomes_from_db(
            db, user_id, current_user.family_id
        )

        if salary > 0 and not has_incomes:
            fixed_income = salary

        monthly_income += fixed_income + variable_income

    # Calcular impacto
    if payment_method in (
        PaymentSource.CREDIT_CARD,
        PaymentSource.LOAN,
    ):
        total_with_interest = amount * (1 + (interest_rate / 100) * installments / 12)
        monthly_payment = total_with_interest / installments
    else:
        total_with_interest = amount
        monthly_payment = amount

    current_balance = monthly_income  # Simplificado
    balance_after = current_balance - monthly_payment

    will_go_negative = balance_after < 0
    impact_pct = (monthly_payment / monthly_income * 100) if monthly_income > 0 else 0

    months_to_recover = None
    if will_go_negative:
        months_to_recover = (
            abs(int(balance_after / (monthly_income * 0.1)))
            if monthly_income > 0
            else 0
        )

    # Recomendação
    if impact_pct > 50:
        recommendation = "❌ NÃO RECOMENDADO: Compromete mais de 50% da renda mensal"
    elif impact_pct > 30:
        recommendation = "⚠️ ATENÇÃO: Compromete 30-50% da renda. Considere parcelar"
    elif (
        payment_method in [PaymentSource.CREDIT_CARD, PaymentSource.LOAN]
        and interest_rate > 5
    ):
        recommendation = "⚠️ Juros altos! Tente negociar ou usar salário"
    else:
        recommendation = "✅ VIÁVEL: Impacto aceitável no orçamento"

    return PurchaseSimulation(
        purchase_amount=amount,
        payment_method=payment_method.value,
        installments=installments,
        interest_rate=interest_rate,
        current_balance=round(current_balance, 2),
        balance_after_purchase=round(balance_after, 2),
        impact_percentage=round(impact_pct, 2),
        will_go_negative=will_go_negative,
        months_to_recover=months_to_recover,
        recommendation=recommendation,
    )
