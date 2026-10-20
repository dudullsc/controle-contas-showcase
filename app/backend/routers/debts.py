from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from database import get_database
from models.debt import (
    Debt,
    DebtCreate,
    DebtPayment,
    DebtPayoffPlan,
    DebtStatus,
    DebtUpdate,
    PaymentStrategy,
)
from models.user import User
from utils.deps import get_current_active_user

router = APIRouter(prefix="/debts", tags=["Dívidas"])

# ========== CRUD DE DÍVIDAS ==========


@router.post("/", response_model=Debt, status_code=status.HTTP_201_CREATED)
async def create_debt(
    debt: DebtCreate, current_user: User = Depends(get_current_active_user)
):
    """Cria uma nova dívida"""
    db = await get_database()

    debt_dict = debt.model_dump()
    debt_dict["user_id"] = current_user.id
    debt_dict["family_id"] = current_user.family_id  # Adiciona family_id
    debt_dict["created_at"] = datetime.now(UTC)
    debt_dict["updated_at"] = datetime.now(UTC)

    result = await db.debts.insert_one(debt_dict)
    created_debt = await db.debts.find_one({"_id": result.inserted_id})
    created_debt["_id"] = str(created_debt["_id"])

    return Debt(**created_debt)


@router.get("/", response_model=list[Debt])
async def list_debts(
    skip: int = 0,
    limit: int = 100,
    status: DebtStatus | None = None,
    current_user: User = Depends(get_current_active_user),
):
    """Lista todas as dívidas da família"""
    db = await get_database()

    query = {"family_id": current_user.family_id}

    if status:
        query["status"] = status

    debts = (
        await db.debts.find(query)
        .sort("due_day", 1)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )

    for debt in debts:
        debt["_id"] = str(debt["_id"])

    return [Debt(**debt) for debt in debts]


@router.get("/{debt_id}", response_model=Debt)
async def get_debt(debt_id: str, current_user: User = Depends(get_current_active_user)):
    """Busca uma dívida específica da família"""
    db = await get_database()

    if not ObjectId.is_valid(debt_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    debt = await db.debts.find_one(
        {"_id": ObjectId(debt_id), "family_id": current_user.family_id}
    )

    if not debt:
        raise HTTPException(status_code=404, detail="Dívida não encontrada")

    debt["_id"] = str(debt["_id"])
    return Debt(**debt)


@router.put("/{debt_id}", response_model=Debt)
async def update_debt(
    debt_id: str,
    debt_update: DebtUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Atualiza uma dívida da família"""
    db = await get_database()

    if not ObjectId.is_valid(debt_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    update_data = debt_update.model_dump(exclude_unset=True)

    if update_data:
        update_data["updated_at"] = datetime.now(UTC)
        await db.debts.update_one(
            {"_id": ObjectId(debt_id), "family_id": current_user.family_id},
            {"$set": update_data},
        )

    updated_debt = await db.debts.find_one({"_id": ObjectId(debt_id)})

    if not updated_debt:
        raise HTTPException(status_code=404, detail="Dívida não encontrada")

    updated_debt["_id"] = str(updated_debt["_id"])
    return Debt(**updated_debt)


@router.delete("/{debt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_debt(
    debt_id: str, current_user: User = Depends(get_current_active_user)
):
    """Remove uma dívida da família"""
    db = await get_database()

    if not ObjectId.is_valid(debt_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    result = await db.debts.delete_one(
        {"_id": ObjectId(debt_id), "family_id": current_user.family_id}
    )

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dívida não encontrada")


# ========== PAGAMENTO DE DÍVIDAS ==========


@router.post("/{debt_id}/payment")
async def register_payment(
    debt_id: str,
    payment: DebtPayment,
    current_user: User = Depends(get_current_active_user),
):
    """Registra um pagamento em uma dívida"""
    db = await get_database()

    if not ObjectId.is_valid(debt_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    debt = await db.debts.find_one(
        {"_id": ObjectId(debt_id), "family_id": current_user.family_id}
    )

    if not debt:
        raise HTTPException(status_code=404, detail="Dívida não encontrada")

    new_balance = debt["current_balance"] - payment.amount

    if new_balance < 0:
        new_balance = 0

    update_data = {
        "current_balance": new_balance,
        "updated_at": datetime.now(UTC),
    }

    # Se quitou a dívida
    if new_balance == 0:
        update_data["status"] = DebtStatus.PAID_OFF

    await db.debts.update_one({"_id": ObjectId(debt_id)}, {"$set": update_data})

    # Registrar histórico de pagamento
    payment_record = payment.model_dump()
    payment_record["debt_id"] = debt_id
    payment_record["user_id"] = current_user.id
    await db.debt_payments.insert_one(payment_record)

    return {"message": "Pagamento registrado com sucesso", "new_balance": new_balance}


# ========== ANÁLISES E ESTRATÉGIAS ==========


@router.get("/summary/total")
async def get_debt_summary(current_user: User = Depends(get_current_active_user)):
    """Retorna resumo total das dívidas"""
    db = await get_database()

    pipeline = [
        {"$match": {"user_id": current_user.id, "status": DebtStatus.ACTIVE}},
        {
            "$group": {
                "_id": None,
                "total_debt": {"$sum": "$current_balance"},
                "total_original": {"$sum": "$total_amount"},
                "average_interest": {"$avg": "$interest_rate"},
                "count": {"$sum": 1},
                "highest_interest": {"$max": "$interest_rate"},
                "highest_balance": {"$max": "$current_balance"},
            }
        },
    ]

    result = await db.debts.aggregate(pipeline).to_list(length=1)

    if not result:
        return {
            "total_debt": 0,
            "total_original": 0,
            "average_interest": 0,
            "count": 0,
            "highest_interest": 0,
            "highest_balance": 0,
            "monthly_interest_cost": 0,
        }

    summary = result[0]
    # Calcular custo mensal de juros
    total_debt = summary["total_debt"]
    avg_interest = summary["average_interest"]
    monthly_interest_cost = (total_debt * avg_interest) / 100

    return {
        "total_debt": round(total_debt, 2),
        "total_original": round(summary["total_original"], 2),
        "average_interest": round(avg_interest, 2),
        "count": summary["count"],
        "highest_interest": round(summary["highest_interest"], 2),
        "highest_balance": round(summary["highest_balance"], 2),
        "monthly_interest_cost": round(monthly_interest_cost, 2),
    }


@router.post("/payoff-plan", response_model=DebtPayoffPlan)
async def calculate_payoff_plan(
    strategy: PaymentStrategy,
    monthly_payment: float = Query(..., gt=0),
    current_user: User = Depends(get_current_active_user),
):
    """Calcula estratégia de pagamento de dívidas"""
    db = await get_database()

    # Buscar todas as dívidas ativas
    debts = await db.debts.find(
        {"user_id": current_user.id, "status": DebtStatus.ACTIVE}
    ).to_list(length=None)

    if not debts:
        raise HTTPException(status_code=404, detail="Nenhuma dívida ativa encontrada")

    for debt in debts:
        debt["_id"] = str(debt["_id"])

    debt_objects = [Debt(**debt) for debt in debts]

    # Ordenar dívidas conforme estratégia
    if strategy == PaymentStrategy.SNOWBALL:
        # Menor saldo primeiro
        sorted_debts = sorted(debt_objects, key=lambda d: d.current_balance)
    elif strategy == PaymentStrategy.AVALANCHE:
        # Maior juros primeiro
        sorted_debts = sorted(debt_objects, key=lambda d: d.interest_rate, reverse=True)
    else:
        sorted_debts = debt_objects

    total_debt = sum(d.current_balance for d in debt_objects)

    # Simular pagamento mês a mês
    monthly_breakdown = []
    remaining_debts = [
        {
            "id": d.id,
            "balance": d.current_balance,
            "rate": d.interest_rate,
            "name": d.name,
        }
        for d in sorted_debts
    ]
    month = 0
    total_interest_paid = 0

    while remaining_debts and month < 600:  # Limite de 50 anos
        month += 1
        month_details = {"month": month, "payments": []}

        # Aplicar juros
        for debt in remaining_debts:
            interest = debt["balance"] * (debt["rate"] / 100)
            debt["balance"] += interest
            total_interest_paid += interest

        # Distribuir pagamento
        payment_left = monthly_payment

        for debt in remaining_debts[:]:
            if payment_left <= 0:
                break

            minimum_payment = debt["balance"] * 0.02  # Mínimo 2% do saldo

            if debt == remaining_debts[0]:  # Prioridade total
                amount_to_pay = min(payment_left, debt["balance"])
            else:
                amount_to_pay = min(minimum_payment, payment_left, debt["balance"])

            debt["balance"] -= amount_to_pay
            payment_left -= amount_to_pay

            month_details["payments"].append(
                {
                    "debt_name": debt["name"],
                    "amount_paid": round(amount_to_pay, 2),
                    "remaining_balance": round(debt["balance"], 2),
                }
            )

            if debt["balance"] <= 0:
                remaining_debts.remove(debt)

        monthly_breakdown.append(month_details)

        if not remaining_debts:
            break

    payoff_order = [d.id for d in sorted_debts]

    return DebtPayoffPlan(
        strategy=strategy,
        monthly_payment=monthly_payment,
        debts=debt_objects,
        total_debt=round(total_debt, 2),
        total_interest=round(total_interest_paid, 2),
        months_to_payoff=month,
        payoff_order=payoff_order,
        # Retornar só primeiros 24 meses
        monthly_breakdown=monthly_breakdown[:24],
    )
