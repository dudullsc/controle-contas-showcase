from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from database import get_database
from models.income import IncomeCreate, IncomeResponse, IncomeType, IncomeUpdate
from models.user import User
from utils.deps import get_current_active_user

router = APIRouter(prefix="/incomes", tags=["Receitas"])


async def get_user_by_id(db, user_id: str, family_id: str) -> dict | None:
    """Busca usuário validando que pertence à mesma família"""
    try:
        user = await db.users.find_one(
            {"_id": ObjectId(user_id), "family_id": family_id}
        )
        return user
    except Exception:
        return None


def income_to_response(income: dict, user_name: str) -> IncomeResponse:
    """Converte income do DB para IncomeResponse"""
    return IncomeResponse(
        id=str(income["_id"]),
        description=income["description"],
        amount=income["amount"],
        income_type=income["income_type"],
        payment_day=income.get("payment_day"),
        payment_date=income.get("payment_date"),
        notes=income.get("notes"),
        is_active=income.get("is_active", True),
        user_id=income["user_id"],
        user_name=user_name,
        family_id=income["family_id"],
        created_at=income["created_at"],
        updated_at=income["updated_at"],
    )


@router.post("/", response_model=IncomeResponse, status_code=status.HTTP_201_CREATED)
async def create_income(
    income: IncomeCreate, current_user: User = Depends(get_current_active_user)
):
    """Cria uma nova receita"""
    db = await get_database()

    # Validar que o user_id pertence à mesma família
    target_user = await get_user_by_id(db, income.user_id, current_user.family_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado ou não pertence à sua família",
        )

    # Forçar family_id do usuário atual (segurança)
    income_dict = income.model_dump()
    income_dict["family_id"] = current_user.family_id
    income_dict["created_at"] = datetime.now(UTC)
    income_dict["updated_at"] = datetime.now(UTC)

    result = await db.incomes.insert_one(income_dict)
    created_income = await db.incomes.find_one({"_id": result.inserted_id})

    return income_to_response(created_income, target_user["full_name"])


@router.get("/", response_model=list[IncomeResponse])
async def list_incomes(
    user_id: str | None = None,
    income_type: IncomeType | None = None,
    is_active: bool | None = None,
    current_user: User = Depends(get_current_active_user),
):
    """Lista todas as receitas da família com filtros opcionais"""
    db = await get_database()

    # Filtro base: apenas da mesma família
    query = {"family_id": current_user.family_id}

    if user_id:
        # Validar que o user_id pertence à mesma família
        target_user = await get_user_by_id(db, user_id, current_user.family_id)
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuário não encontrado ou não pertence à sua família",
            )
        query["user_id"] = user_id

    if income_type:
        query["income_type"] = income_type

    if is_active is not None:
        query["is_active"] = is_active

    incomes = await db.incomes.find(query).sort("created_at", -1).to_list(length=None)

    # Buscar nomes dos usuários
    user_ids = list({inc["user_id"] for inc in incomes})
    users = await db.users.find(
        {
            "_id": {"$in": [ObjectId(uid) for uid in user_ids]},
            "family_id": current_user.family_id,
        }
    ).to_list(length=None)

    user_names = {str(u["_id"]): u.get("full_name", "Usuário") for u in users}

    return [
        income_to_response(inc, user_names.get(inc["user_id"], "Usuário"))
        for inc in incomes
    ]


@router.get("/{income_id}", response_model=IncomeResponse)
async def get_income(
    income_id: str, current_user: User = Depends(get_current_active_user)
):
    """Busca uma receita específica"""
    db = await get_database()

    try:
        income = await db.incomes.find_one(
            {"_id": ObjectId(income_id), "family_id": current_user.family_id}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="ID inválido"
        )

    if not income:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Receita não encontrada"
        )

    user = await get_user_by_id(db, income["user_id"], current_user.family_id)
    user_name = user.get("full_name", "Usuário") if user else "Usuário"

    return income_to_response(income, user_name)


@router.put("/{income_id}", response_model=IncomeResponse)
async def update_income(
    income_id: str,
    income_update: IncomeUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Atualiza uma receita"""
    db = await get_database()

    try:
        existing = await db.incomes.find_one(
            {"_id": ObjectId(income_id), "family_id": current_user.family_id}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="ID inválido"
        )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Receita não encontrada"
        )

    # Atualizar apenas campos fornecidos
    update_data = dict(income_update.model_dump(exclude_unset=True).items())

    if update_data:
        update_data["updated_at"] = datetime.now(UTC)
        await db.incomes.update_one({"_id": ObjectId(income_id)}, {"$set": update_data})

    updated_income = await db.incomes.find_one({"_id": ObjectId(income_id)})
    user = await get_user_by_id(db, updated_income["user_id"], current_user.family_id)
    user_name = user.get("full_name", "Usuário") if user else "Usuário"

    return income_to_response(updated_income, user_name)


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(
    income_id: str, current_user: User = Depends(get_current_active_user)
):
    """Remove uma receita"""
    db = await get_database()

    try:
        result = await db.incomes.delete_one(
            {"_id": ObjectId(income_id), "family_id": current_user.family_id}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="ID inválido"
        )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Receita não encontrada"
        )

    return None


@router.get("/summary/totals")
async def get_income_summary(current_user: User = Depends(get_current_active_user)):
    """Retorna resumo de receitas (fixas, variáveis e total) da família"""
    db = await get_database()

    # Buscar todas receitas ativas da família
    incomes = await db.incomes.find(
        {"family_id": current_user.family_id, "is_active": True}
    ).to_list(length=None)

    total_fixed = sum(
        inc["amount"] for inc in incomes if inc["income_type"] == IncomeType.FIXED
    )
    total_variable = sum(
        inc["amount"] for inc in incomes if inc["income_type"] == IncomeType.VARIABLE
    )
    total = total_fixed + total_variable

    # Agrupar por usuário
    user_totals = {}
    for inc in incomes:
        uid = inc["user_id"]
        if uid not in user_totals:
            user_totals[uid] = {"fixed": 0, "variable": 0, "total": 0}

        if inc["income_type"] == IncomeType.FIXED:
            user_totals[uid]["fixed"] += inc["amount"]
        else:
            user_totals[uid]["variable"] += inc["amount"]
        user_totals[uid]["total"] += inc["amount"]

    # Buscar nomes dos usuários
    user_ids = list(user_totals.keys())
    users = await db.users.find(
        {
            "_id": {"$in": [ObjectId(uid) for uid in user_ids]},
            "family_id": current_user.family_id,
        }
    ).to_list(length=None)

    user_details = []
    for user in users:
        uid = str(user["_id"])
        if uid in user_totals:
            user_details.append(
                {
                    "user_id": uid,
                    "user_name": user.get("full_name", "Usuário"),
                    "fixed_income": round(user_totals[uid]["fixed"], 2),
                    "variable_income": round(user_totals[uid]["variable"], 2),
                    "total_income": round(user_totals[uid]["total"], 2),
                }
            )

    return {
        "total_fixed_income": round(total_fixed, 2),
        "total_variable_income": round(total_variable, 2),
        "total_income": round(total, 2),
        "by_user": user_details,
        "active_incomes_count": len(incomes),
    }
