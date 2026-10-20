from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query

from database import get_database
from models.income import IncomeType
from models.monthly_summary import (
    CategoryTotal,
    MonthlySummary,
    MonthlyTotal,
    OwnerTotal,
    YearlySummary,
)
from models.user import User
from utils.deps import get_current_active_user

router = APIRouter(prefix="/reports", tags=["Relatórios"])


async def calculate_incomes_for_period(
    db, family_id: str, month: int, year: int
) -> tuple[float, float, float]:
    """
    Calcula receitas fixas, variáveis e total para um período específico.
    Para receitas FIXAS: considera todas as receitas ativas (são mensais)
    Para receitas VARIÁVEIS: filtra por payment_date no mês/ano especificado
    """
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    # Buscar todas as receitas fixas ativas (são mensais, então todas contam)
    fixed_incomes = await db.incomes.find(
        {"family_id": family_id, "income_type": IncomeType.FIXED, "is_active": True}
    ).to_list(length=None)
    total_fixed = sum(inc["amount"] for inc in fixed_incomes)
    # Buscar receitas variáveis com payment_date no período
    variable_incomes = await db.incomes.find(
        {
            "family_id": family_id,
            "income_type": IncomeType.VARIABLE,
            "payment_date": {"$gte": start_date, "$lt": end_date},
        }
    ).to_list(length=None)

    # Se não tem payment_date, usar created_at como fallback
    variable_incomes_no_date = await db.incomes.find(
        {
            "family_id": family_id,
            "income_type": IncomeType.VARIABLE,
            "payment_date": None,
            "created_at": {"$gte": start_date, "$lt": end_date},
        }
    ).to_list(length=None)
    total_variable = sum(inc["amount"] for inc in variable_incomes) + sum(
        inc["amount"] for inc in variable_incomes_no_date
    )
    total_income = total_fixed + total_variable
    return total_fixed, total_variable, total_income


@router.get("/monthly", response_model=MonthlySummary)
async def get_monthly_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000),
    current_user: User = Depends(get_current_active_user),
):
    """Retorna o resumo mensal das despesas"""
    db = await get_database()
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    pipeline = [
        {
            "$match": {
                "family_id": current_user.family_id,
                "due_date": {"$gte": start_date, "$lt": end_date},
            }
        },
        {
            "$group": {
                "_id": None,
                "total_expenses": {"$sum": "$amount"},
                "total_paid": {
                    "$sum": {"$cond": [{"$eq": ["$status", "PAGO"]}, "$amount", 0]}
                },
                "total_pending": {
                    "$sum": {"$cond": [{"$eq": ["$status", "EM ABERTO"]}, "$amount", 0]}
                },
                "expense_count": {"$sum": 1},
            }
        },
    ]
    result = await db.expenses.aggregate(pipeline).to_list(length=1)

    # Calcular receitas para o período
    (
        total_fixed_income,
        total_variable_income,
        total_income,
    ) = await calculate_incomes_for_period(db, current_user.family_id, month, year)

    if not result:
        return MonthlySummary(
            user_id=current_user.id,
            month=month,
            year=year,
            total_expenses=0,
            total_paid=0,
            total_pending=0,
            expenses_by_status={},
            expenses_by_category=[],
            expense_count=0,
            total_fixed_income=total_fixed_income,
            total_variable_income=total_variable_income,
            total_income=total_income,
        )

    # Agrupa por status
    status_pipeline = [
        {
            "$match": {
                "family_id": current_user.family_id,
                "due_date": {"$gte": start_date, "$lt": end_date},
            }
        },
        {"$group": {"_id": "$status", "total": {"$sum": "$amount"}}},
    ]

    status_result = await db.expenses.aggregate(status_pipeline).to_list(length=None)
    expenses_by_status = {item["_id"]: item["total"] for item in status_result}

    # Agrupa por categoria
    category_pipeline = [
        {
            "$match": {
                "family_id": current_user.family_id,
                "due_date": {"$gte": start_date, "$lt": end_date},
            }
        },
        {
            "$group": {
                "_id": "$category",
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"total": -1}},
    ]

    category_result = await db.expenses.aggregate(category_pipeline).to_list(
        length=None
    )
    total_expenses = result[0]["total_expenses"]

    expenses_by_category = [
        CategoryTotal(
            category=item["_id"] or "Sem categoria",
            total=item["total"],
            percentage=round((item["total"] / total_expenses * 100), 2)
            if total_expenses > 0
            else 0,
            count=item["count"],
        )
        for item in category_result
    ]

    # Agrupa por pessoa (owner_name) com lookup para full_name dinâmico
    owner_pipeline = [
        {
            "$match": {
                "family_id": current_user.family_id,
                "due_date": {"$gte": start_date, "$lt": end_date},
            }
        },
        {
            "$addFields": {
                "user_id_obj": {
                    "$cond": [
                        {
                            "$and": [
                                {"$ne": ["$user_id", None]},
                                {"$ne": ["$user_id", ""]},
                            ]
                        },
                        {"$toObjectId": "$user_id"},
                        None,
                    ]
                }
            }
        },
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id_obj",
                "foreignField": "_id",
                "as": "user_data",
            }
        },
        {
            "$group": {
                "_id": "$owner_name",
                "user_id": {"$first": "$user_id"},
                "full_name": {
                    "$first": {
                        "$cond": [
                            {"$gt": [{"$size": "$user_data"}, 0]},
                            {"$arrayElemAt": ["$user_data.full_name", 0]},
                            "$owner_name",
                        ]
                    }
                },
                "total_expenses": {"$sum": "$amount"},
                "total_paid": {
                    "$sum": {"$cond": [{"$eq": ["$status", "PAGO"]}, "$amount", 0]}
                },
                "total_pending": {
                    "$sum": {"$cond": [{"$eq": ["$status", "EM ABERTO"]}, "$amount", 0]}
                },
                "total_open": {
                    "$sum": {"$cond": [{"$eq": ["$status", "NÃO PAGO"]}, "$amount", 0]}
                },
                "expense_count": {"$sum": 1},
            }
        },
    ]

    owner_result = await db.expenses.aggregate(owner_pipeline).to_list(length=None)

    # Ordenar alfabeticamente para manter consistência
    sorted_owner_data = sorted(owner_result, key=lambda x: x.get("_id", ""))

    # Criar lista dinâmica de proprietários com seus totais
    owners_list = [
        OwnerTotal(
            owner=data.get("_id") or "Sem proprietário",
            full_name=data.get("full_name") or data.get("_id") or "Sem proprietário",
            total_expenses=data.get("total_expenses", 0),
            total_paid=data.get("total_paid", 0),
            total_pending=data.get("total_pending", 0),
            total_open=data.get("total_open", 0),
            expense_count=data.get("expense_count", 0),
        )
        for data in sorted_owner_data
    ]

    return MonthlySummary(
        user_id=current_user.id,
        month=month,
        year=year,
        total_expenses=result[0]["total_expenses"],
        total_paid=result[0]["total_paid"],
        total_pending=result[0]["total_pending"],
        expenses_by_status=expenses_by_status,
        expenses_by_category=expenses_by_category,
        expense_count=result[0]["expense_count"],
        owners=owners_list,
        total_fixed_income=total_fixed_income,
        total_variable_income=total_variable_income,
        total_income=total_income,
    )


@router.get("/yearly", response_model=YearlySummary)
async def get_yearly_summary(
    year: int = Query(..., ge=2000),
    current_user: User = Depends(get_current_active_user),
):
    """Retorna o resumo anual das despesas"""
    db = await get_database()

    monthly_totals = []
    total_year = 0.0

    for month in range(1, 13):
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)

        # Agrupa por status
        pipeline = [
            {
                "$match": {
                    "family_id": current_user.family_id,
                    "due_date": {"$gte": start_date, "$lt": end_date},
                }
            },
            {"$group": {"_id": "$status", "total": {"$sum": "$amount"}}},
        ]

        result = await db.expenses.aggregate(pipeline).to_list(length=None)

        # Calcular receitas para este mês
        (
            month_fixed,
            month_variable,
            month_total_income,
        ) = await calculate_incomes_for_period(db, current_user.family_id, month, year)

        month_data = {
            "month": month,
            "year": year,
            "total_paid": 0.0,
            "total_pending": 0.0,
            "total_open": 0.0,
            "total_fixed_income": month_fixed,
            "total_variable_income": month_variable,
            "total_income": month_total_income,
        }

        for item in result:
            if item["_id"] == "PAGO":
                month_data["total_paid"] = item["total"]
            elif item["_id"] == "EM ABERTO":
                month_data["total_pending"] = item["total"]
            elif item["_id"] == "NÃO PAGO":
                month_data["total_open"] = item["total"]

        # Agrupa por pessoa no mês com lookup para full_name dinâmico
        owner_pipeline = [
            {
                "$match": {
                    "family_id": current_user.family_id,
                    "due_date": {"$gte": start_date, "$lt": end_date},
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "user_id",
                    "foreignField": "_id",
                    "as": "user_data",
                }
            },
            {
                "$group": {
                    "_id": "$owner_name",
                    "user_id": {"$first": "$user_id"},
                    "full_name": {
                        "$first": {
                            "$cond": [
                                {"$gt": [{"$size": "$user_data"}, 0]},
                                {"$arrayElemAt": ["$user_data.full_name", 0]},
                                "$owner_name",
                            ]
                        }
                    },
                    "total_expenses": {"$sum": "$amount"},
                    "total_paid": {
                        "$sum": {"$cond": [{"$eq": ["$status", "PAGO"]}, "$amount", 0]}
                    },
                    "total_pending": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", "EM ABERTO"]}, "$amount", 0]
                        }
                    },
                    "total_open": {
                        "$sum": {
                            "$cond": [{"$eq": ["$status", "NÃO PAGO"]}, "$amount", 0]
                        }
                    },
                    "expense_count": {"$sum": 1},
                }
            },
        ]

        owner_result = await db.expenses.aggregate(owner_pipeline).to_list(length=None)

        # Ordenar alfabeticamente para manter consistência
        sorted_owner_data = sorted(owner_result, key=lambda x: x.get("_id", ""))

        # Criar lista dinâmica de proprietários para este mês
        owners_month = [
            OwnerTotal(
                owner=data.get("_id") or "Sem proprietário",
                full_name=data.get("full_name")
                or data.get("_id")
                or "Sem proprietário",
                total_expenses=data.get("total_expenses", 0),
                total_paid=data.get("total_paid", 0),
                total_pending=data.get("total_pending", 0),
                total_open=data.get("total_open", 0),
                expense_count=data.get("expense_count", 0),
            )
            for data in sorted_owner_data
        ]

        month_data["owners"] = owners_month

        # Somar apenas despesas PAGAS para o total anual
        total_year += month_data["total_paid"]

        monthly_totals.append(MonthlyTotal(**month_data))

    # Calcular totais anuais por pessoa com lookup para full_name dinâmico
    yearly_owner_pipeline = [
        {
            "$match": {
                "family_id": current_user.family_id,
                "due_date": {
                    "$gte": datetime(year, 1, 1),
                    "$lt": datetime(year + 1, 1, 1),
                },
            }
        },
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_data",
            }
        },
        {
            "$group": {
                "_id": "$owner_name",
                "user_id": {"$first": "$user_id"},
                "full_name": {
                    "$first": {
                        "$cond": [
                            {"$gt": [{"$size": "$user_data"}, 0]},
                            {"$arrayElemAt": ["$user_data.full_name", 0]},
                            "$owner_name",
                        ]
                    }
                },
                "total_expenses": {"$sum": "$amount"},
                "total_paid": {
                    "$sum": {"$cond": [{"$eq": ["$status", "PAGO"]}, "$amount", 0]}
                },
                "total_pending": {
                    "$sum": {"$cond": [{"$eq": ["$status", "EM ABERTO"]}, "$amount", 0]}
                },
                "total_open": {
                    "$sum": {"$cond": [{"$eq": ["$status", "NÃO PAGO"]}, "$amount", 0]}
                },
                "expense_count": {"$sum": 1},
            }
        },
    ]

    yearly_owner_result = await db.expenses.aggregate(yearly_owner_pipeline).to_list(
        length=None
    )

    # Ordenar alfabeticamente para manter consistência
    sorted_yearly_owner_data = sorted(
        yearly_owner_result, key=lambda x: x.get("_id", "")
    )

    # Criar lista dinâmica de proprietários para o ano
    owners_yearly = [
        OwnerTotal(
            owner=data.get("_id") or "Sem proprietário",
            full_name=data.get("full_name") or data.get("_id") or "Sem proprietário",
            total_expenses=data.get("total_expenses", 0),
            total_paid=data.get("total_paid", 0),
            total_pending=data.get("total_pending", 0),
            total_open=data.get("total_open", 0),
            expense_count=data.get("expense_count", 0),
        )
        for data in sorted_yearly_owner_data
    ]

    # Calcular totais anuais de receitas
    total_fixed_year = 0.0
    total_variable_year = 0.0

    for month_total in monthly_totals:
        total_fixed_year += month_total.total_fixed_income
        total_variable_year += month_total.total_variable_income

    total_income_year = total_fixed_year + total_variable_year

    return YearlySummary(
        user_id=current_user.id,
        year=year,
        monthly_totals=monthly_totals,
        total_year=total_year,
        average_month=round(total_year / 12, 2),
        owners=owners_yearly,
        total_fixed_income=total_fixed_year,
        total_variable_income=total_variable_year,
        total_income=total_income_year,
    )


@router.get("/income-vs-expenses")
async def get_income_vs_expenses(
    start_date: str | None = None,
    end_date: str | None = None,
    year: int | None = None,
    user_id: str | None = None,
    current_user: User = Depends(get_current_active_user),
):
    """
    Retorna extrato de salários vs despesas com filtros de data e usuário.
    Retorna dados agrupados por mês no período especificado.
    """
    db = await get_database()

    # Determinar período
    if year:
        start = datetime(year, 1, 1)
        end = datetime(year + 1, 1, 1)
    elif start_date and end_date:
        start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    else:
        # Se não especificado, usar ano atual
        now = datetime.now(UTC)
        start = datetime(now.year, 1, 1)
        end = datetime(now.year + 1, 1, 1)

    # Construir filtro base
    family_filter = {"family_id": current_user.family_id}
    if user_id:
        family_filter["user_id"] = user_id

    # Buscar despesas no período
    expense_query = {**family_filter, "due_date": {"$gte": start, "$lt": end}}

    expenses = await db.expenses.find(expense_query).to_list(length=None)

    # Agrupar despesas por mês
    monthly_data = {}
    current = start
    while current < end:
        month_key = f"{current.year}-{current.month:02d}"
        month_start = datetime(current.year, current.month, 1)
        if current.month == 12:
            month_end = datetime(current.year + 1, 1, 1)
        else:
            month_end = datetime(current.year, current.month + 1, 1)

        # Filtrar despesas deste mês
        month_expenses = [
            e
            for e in expenses
            if month_start <= e.get("due_date", datetime.min) < month_end
        ]

        total_paid = sum(
            e.get("amount", 0) for e in month_expenses if e.get("status") == "PAGO"
        )
        total_pending = sum(
            e.get("amount", 0) for e in month_expenses if e.get("status") == "EM ABERTO"
        )
        total_open = sum(
            e.get("amount", 0) for e in month_expenses if e.get("status") == "NÃO PAGO"
        )

        # Calcular receitas para este mês
        (
            month_fixed,
            month_variable,
            month_total_income,
        ) = await calculate_incomes_for_period(
            db, current_user.family_id, current.month, current.year
        )

        # Se há filtro de usuário, filtrar receitas também
        if user_id:
            # Buscar receitas do usuário
            user_fixed_incomes = await db.incomes.find(
                {
                    "family_id": current_user.family_id,
                    "user_id": user_id,
                    "income_type": IncomeType.FIXED,
                    "is_active": True,
                }
            ).to_list(length=None)

            user_variable_incomes = await db.incomes.find(
                {
                    "family_id": current_user.family_id,
                    "user_id": user_id,
                    "income_type": IncomeType.VARIABLE,
                    "payment_date": {"$gte": month_start, "$lt": month_end},
                }
            ).to_list(length=None)

            user_variable_no_date = await db.incomes.find(
                {
                    "family_id": current_user.family_id,
                    "user_id": user_id,
                    "income_type": IncomeType.VARIABLE,
                    "payment_date": None,
                    "created_at": {"$gte": month_start, "$lt": month_end},
                }
            ).to_list(length=None)

            month_fixed = sum(inc.get("amount", 0) for inc in user_fixed_incomes)
            month_variable = sum(
                inc.get("amount", 0) for inc in user_variable_incomes
            ) + sum(inc.get("amount", 0) for inc in user_variable_no_date)
            month_total_income = month_fixed + month_variable

        monthly_data[month_key] = {
            "month": current.month,
            "year": current.year,
            "total_fixed_income": month_fixed,
            "total_variable_income": month_variable,
            "total_income": month_total_income,
            "total_paid": total_paid,
            "total_pending": total_pending,
            "total_open": total_open,
        }

        # Avançar para próximo mês
        if current.month == 12:
            current = datetime(current.year + 1, 1, 1)
        else:
            current = datetime(current.year, current.month + 1, 1)

    # Converter para lista ordenada
    monthly_totals = [
        MonthlyTotal(**data)
        for key in sorted(monthly_data.keys())
        for data in [monthly_data[key]]
    ]

    # Calcular totais
    total_fixed = sum(m.total_fixed_income for m in monthly_totals)
    total_variable = sum(m.total_variable_income for m in monthly_totals)
    total_income = total_fixed + total_variable
    total_expenses = sum(
        m.total_paid + m.total_pending + m.total_open for m in monthly_totals
    )

    return {
        "monthly_totals": monthly_totals,
        "total_fixed_income": total_fixed,
        "total_variable_income": total_variable,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "balance": total_income - total_expenses,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
    }
