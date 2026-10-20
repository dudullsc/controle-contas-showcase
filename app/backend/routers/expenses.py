import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from bson import ObjectId
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import Response
from pydantic import BaseModel

from database import get_database
from models.expense import (
    Expense,
    ExpenseCreate,
    ExpenseStatus,
    ExpenseUpdate,
    PaymentSource,
    ReceiptAmountCheck,
)
from models.user import User
from services import gemini_receipt, s3_storage
from utils.deps import get_current_active_user

router = APIRouter(prefix="/expenses", tags=["Despesas"])

# --- Modelos para o Resumo (Dashboard) ---


class OwnerSummary(BaseModel):
    owner: str
    full_name: str
    total_expenses: float
    total_paid: float
    total_pending: float
    expense_count: int


class MonthlySummary(BaseModel):
    total_expenses: float
    total_paid: float
    total_pending: float
    expense_count: int
    owners: list[OwnerSummary]


# -----------------------------------------


def _receipt_object_key(expense: dict | None) -> str | None:
    receipt = (expense or {}).get("receipt") or {}
    key = receipt.get("object_key")
    return key if key else None


async def _get_family_expense(expense_id: str, family_id: str | None) -> dict:
    if not ObjectId.is_valid(expense_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    db = await get_database()
    expense = await db.expenses.find_one(
        {"_id": ObjectId(expense_id), "family_id": family_id}
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    return expense


async def _to_expense_response(expense: dict) -> Expense:
    expense = dict(expense)
    expense["_id"] = str(expense["_id"])
    return Expense(**expense)


@router.post("/", response_model=Expense, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense: ExpenseCreate, current_user: User = Depends(get_current_active_user)
):
    """Cria uma nova despesa"""
    db = await get_database()

    expense_dict = expense.model_dump()
    expense_dict["user_id"] = current_user.id
    expense_dict["family_id"] = current_user.family_id  # Adiciona family_id
    # Adiciona nome do usuário
    expense_dict["owner_name"] = current_user.full_name
    expense_dict["created_by"] = current_user.email
    expense_dict["created_at"] = datetime.now(UTC)
    expense_dict["updated_at"] = datetime.now(UTC)

    if expense_dict.get("status") == ExpenseStatus.PAGO:
        expense_dict["paid_at"] = datetime.now(UTC)
        expense_dict["paid_by_user_id"] = current_user.id
        expense_dict["paid_by_name"] = current_user.full_name

    # Normaliza metadados de parcelas para garantir agrupamento consistente
    installments_total = expense_dict.get("installment_total") or expense_dict.get(
        "installments"
    )
    if installments_total:
        expense_dict["installment_total"] = installments_total
        expense_dict.setdefault("installment_number", 1)
        if installments_total > 1:
            expense_dict.setdefault("installment_group_id", str(uuid.uuid4()))

    result = await db.expenses.insert_one(expense_dict)
    created_expense = await db.expenses.find_one({"_id": result.inserted_id})
    created_expense["_id"] = str(created_expense["_id"])

    return Expense(**created_expense)


@router.get("/summary", response_model=MonthlySummary)
async def get_expenses_summary(
    status: ExpenseStatus | None = None,
    user_id: str | None = None,
    category: str | None = None,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    current_user: User = Depends(get_current_active_user),
):
    """
    Retorna o resumo financeiro (cards)
    aplicando os mesmos filtros da listagem.
    Calcula dinamicamente Totais,
    Pagos e Pendentes baseados na data e usuário escolhidos.
    """
    db = await get_database()

    # 1. Monta a Query (Reutilizando lógica de filtro)
    query = {"family_id": current_user.family_id}

    if status:
        query["status"] = status
    if user_id:
        query["user_id"] = user_id
    if category:
        query["category"] = category

    # Filtro de Data
    if start_date or end_date:
        date_query = {}
        if start_date:
            # Tratamento para formatos ISO com Z
            date_query["$gte"] = datetime.fromisoformat(
                start_date.replace("Z", "+00:00")
            )
        if end_date:
            date_query["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        if date_query:
            query["due_date"] = date_query
    elif month and year:
        s_date = datetime(year, month, 1)
        if month == 12:
            e_date = datetime(year + 1, 1, 1)
        else:
            e_date = datetime(year, month + 1, 1)
        query["due_date"] = {"$gte": s_date, "$lt": e_date}

    # 2. Pipeline de Agregação para Totais Gerais
    pipeline_total = [
        {"$match": query},
        {
            "$group": {
                "_id": None,
                "total_expenses": {"$sum": "$amount"},
                "total_paid": {
                    "$sum": {"$cond": [{"$eq": ["$status", "PAGO"]}, "$amount", 0]}
                },
                "total_pending": {
                    "$sum": {"$cond": [{"$ne": ["$status", "PAGO"]}, "$amount", 0]}
                },
                "expense_count": {"$sum": 1},
            }
        },
    ]

    # 3. Pipeline para Agrupar por Dono (Owner)
    # Isso permite saber quanto cada pessoa gastou dentro do filtro aplicado
    pipeline_owners = [
        {"$match": query},
        # Lookup para pegar nome real do usuário se disponível
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
            "$addFields": {
                "display_name": {
                    "$cond": [
                        {"$gt": [{"$size": "$user_data"}, 0]},
                        {"$arrayElemAt": ["$user_data.full_name", 0]},
                        "$owner_name",
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": "$display_name",  # Agrupa pelo nome dinâmico
                "total_expenses": {"$sum": "$amount"},
                "total_paid": {
                    "$sum": {"$cond": [{"$eq": ["$status", "PAGO"]}, "$amount", 0]}
                },
                "total_pending": {
                    "$sum": {"$cond": [{"$ne": ["$status", "PAGO"]}, "$amount", 0]}
                },
                "expense_count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]

    results_total = await db.expenses.aggregate(pipeline_total).to_list(length=1)
    results_owners = await db.expenses.aggregate(pipeline_owners).to_list(length=None)

    # Formata a resposta
    summary_data = {
        "total_expenses": (results_total[0]["total_expenses"] if results_total else 0),
        "total_paid": (results_total[0]["total_paid"] if results_total else 0),
        "total_pending": (results_total[0]["total_pending"] if results_total else 0),
        "expense_count": (results_total[0]["expense_count"] if results_total else 0),
        "owners": [
            {
                "owner": str(r["_id"]) if r["_id"] else "Desconhecido",
                "full_name": str(r["_id"]) if r["_id"] else "Desconhecido",
                "total_expenses": r["total_expenses"],
                "total_paid": r["total_paid"],
                "total_pending": r["total_pending"],
                "expense_count": r["expense_count"],
            }
            for r in results_owners
        ],
    }

    return MonthlySummary(**summary_data)


@router.get("/", response_model=list[Expense])
async def list_expenses(
    skip: int = 0,
    limit: int = 100,
    status: ExpenseStatus | None = None,
    owner_name: str | None = None,
    user_id: str | None = None,
    category: str | None = None,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    paid_start_date: str | None = None,
    paid_end_date: str | None = None,
    current_user: User = Depends(get_current_active_user),
):
    """Lista todas as despesas da família com nome dinâmico do usuário"""
    db = await get_database()

    # Filtro obrigatório por família
    query = {"family_id": current_user.family_id}

    if status:
        query["status"] = status

    if owner_name:
        query["owner_name"] = owner_name

    if user_id:
        query["user_id"] = user_id

    if category:
        query["category"] = category

    # Filtro por data customizado (para relatórios)
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = datetime.fromisoformat(
                start_date.replace("Z", "+00:00")
            )
        if end_date:
            date_query["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        if date_query:
            query["due_date"] = date_query
    # Filtro por mês/ano (para despesas)
    elif month and year:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        query["due_date"] = {"$gte": start_date, "$lt": end_date}

    if paid_start_date or paid_end_date:
        paid_date_query = {}
        if paid_start_date:
            paid_date_query["$gte"] = datetime.fromisoformat(
                paid_start_date.replace("Z", "+00:00")
            )
        if paid_end_date:
            paid_end = datetime.fromisoformat(paid_end_date.replace("Z", "+00:00"))
            # Include the full end date for date-only inputs.
            if (
                paid_end.hour == 0
                and paid_end.minute == 0
                and paid_end.second == 0
                and paid_end.microsecond == 0
            ):
                paid_end = paid_end + timedelta(days=1)
                paid_date_query["$lt"] = paid_end
            else:
                paid_date_query["$lte"] = paid_end
        query["paid_at"] = paid_date_query

    # Pipeline com lookup para trazer full_name dinâmico
    pipeline = [
        {"$match": query},
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
            "$addFields": {
                "full_name": {
                    "$cond": [
                        {"$gt": [{"$size": "$user_data"}, 0]},
                        {"$arrayElemAt": ["$user_data.full_name", 0]},
                        "$owner_name",
                    ]
                }
            }
        },
        {"$project": {"user_data": 0, "user_id_obj": 0}},
        {"$sort": {"due_date": -1}},
        {"$skip": skip},
        {"$limit": limit},
    ]

    expenses = await db.expenses.aggregate(pipeline).to_list(length=limit)

    for expense in expenses:
        expense["_id"] = str(expense["_id"])

    return [Expense(**expense) for expense in expenses]


@router.get("/{expense_id}", response_model=Expense)
async def get_expense(
    expense_id: str, current_user: User = Depends(get_current_active_user)
):
    """Busca uma despesa específica da família com nome dinâmico"""
    db = await get_database()

    if not ObjectId.is_valid(expense_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    # Pipeline com lookup para trazer full_name dinâmico
    pipeline = [
        {"$match": {"_id": ObjectId(expense_id), "family_id": current_user.family_id}},
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
            "$addFields": {
                "full_name": {
                    "$cond": [
                        {"$gt": [{"$size": "$user_data"}, 0]},
                        {"$arrayElemAt": ["$user_data.full_name", 0]},
                        "$owner_name",
                    ]
                }
            }
        },
        {"$project": {"user_data": 0, "user_id_obj": 0}},
    ]

    expense_list = await db.expenses.aggregate(pipeline).to_list(length=1)

    if not expense_list:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

    expense = expense_list[0]
    expense["_id"] = str(expense["_id"])
    return Expense(**expense)


@router.put("/{expense_id}", response_model=Expense)
async def update_expense(
    expense_id: str,
    expense_update: ExpenseUpdate,
    current_user: User = Depends(get_current_active_user),
):
    """Atualiza uma despesa da família"""
    db = await get_database()

    if not ObjectId.is_valid(expense_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    existing_expense = await db.expenses.find_one(
        {
            "_id": ObjectId(expense_id),
            "family_id": current_user.family_id,
        }
    )

    if not existing_expense:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

    update_data = expense_update.model_dump(exclude_unset=True)
    update_data.pop("receipt", None)
    update_data.pop("has_receipt", None)

    if "status" in update_data:
        new_status = update_data["status"]
        old_status = existing_expense.get("status")

        if new_status == ExpenseStatus.PAGO and old_status != ExpenseStatus.PAGO:
            update_data["paid_at"] = datetime.now(UTC)
            update_data["paid_by_user_id"] = current_user.id
            update_data["paid_by_name"] = current_user.full_name
        elif new_status != ExpenseStatus.PAGO:
            update_data["paid_at"] = None
            update_data["paid_by_user_id"] = None
            update_data["paid_by_name"] = None

    update_data["updated_at"] = datetime.now(UTC)

    result = await db.expenses.update_one(
        {
            "_id": ObjectId(expense_id),
            "family_id": current_user.family_id,  # Filtrar por família
        },
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

    updated_expense = await db.expenses.find_one({"_id": ObjectId(expense_id)})
    updated_expense["_id"] = str(updated_expense["_id"])

    return Expense(**updated_expense)


@router.post("/{expense_id}/receipt", response_model=Expense)
async def upload_receipt(
    expense_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    """Anexa ou substitui o comprovante de pagamento da despesa."""
    if not s3_storage.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Armazenamento de comprovantes não configurado",
        )

    existing = await _get_family_expense(expense_id, current_user.family_id)
    data = await file.read()

    try:
        ext, content_type = s3_storage.validate_receipt(data)
    except s3_storage.ReceiptValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    original_filename = file.filename or f"comprovante.{ext}"
    new_key = s3_storage.build_object_key(
        current_user.family_id or "unknown", expense_id, ext
    )
    old_key = _receipt_object_key(existing)

    try:
        await asyncio.to_thread(s3_storage.upload_bytes, new_key, data, content_type)
    except s3_storage.StorageNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail="Falha ao enviar comprovante"
        ) from exc

    receipt = {
        "object_key": new_key,
        "original_filename": original_filename[:200],
        "content_type": content_type,
        "size_bytes": len(data),
        "uploaded_at": datetime.now(UTC),
        "uploaded_by_user_id": current_user.id,
        "uploaded_by_name": current_user.full_name,
    }

    db = await get_database()
    await db.expenses.update_one(
        {"_id": ObjectId(expense_id), "family_id": current_user.family_id},
        {"$set": {"receipt": receipt, "updated_at": datetime.now(UTC)}},
    )

    if old_key and old_key != new_key:
        await asyncio.to_thread(s3_storage.delete_object, old_key)

    updated = await db.expenses.find_one({"_id": ObjectId(expense_id)})
    return await _to_expense_response(updated)


@router.post("/{expense_id}/receipt/analyze", response_model=Expense)
async def analyze_receipt(
    expense_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Analisa o comprovante já anexado com Gemini (valor pago)."""
    if not gemini_receipt.is_configured():
        existing = await _get_family_expense(expense_id, current_user.family_id)
        return await _to_expense_response(existing)

    existing = await _get_family_expense(expense_id, current_user.family_id)
    receipt = existing.get("receipt") or {}
    object_key = receipt.get("object_key")
    if not object_key:
        raise HTTPException(status_code=404, detail="Comprovante não encontrado")

    try:
        body, stored_type = await asyncio.to_thread(s3_storage.get_object, object_key)
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail="Falha ao carregar comprovante"
        ) from exc

    content_type = receipt.get("content_type") or stored_type
    detected = await gemini_receipt.detect_receipt_total(body, content_type)
    expense = await _to_expense_response(existing)
    check_data = gemini_receipt.build_amount_check(
        float(existing.get("amount") or 0), detected
    )
    if check_data:
        expense.receipt_amount_check = ReceiptAmountCheck(**check_data)
        db = await get_database()
        await db.expenses.update_one(
            {"_id": ObjectId(expense_id), "family_id": current_user.family_id},
            {
                "$set": {
                    "receipt_amount_check": check_data,
                    "updated_at": datetime.now(UTC),
                }
            },
        )
    return expense


@router.get("/{expense_id}/receipt")
async def get_receipt(
    expense_id: str,
    download: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
):
    """Visualiza ou baixa o comprovante anexado."""
    existing = await _get_family_expense(expense_id, current_user.family_id)
    receipt = existing.get("receipt") or {}
    object_key = receipt.get("object_key")
    if not object_key:
        raise HTTPException(status_code=404, detail="Comprovante não encontrado")

    try:
        body, stored_type = await asyncio.to_thread(s3_storage.get_object, object_key)
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail="Falha ao carregar comprovante"
        ) from exc

    content_type = receipt.get("content_type") or stored_type
    filename = receipt.get("original_filename") or "comprovante"
    disposition = "attachment" if download else "inline"
    headers = {
        "Content-Disposition": (
            f"{disposition}; filename*=UTF-8''{quote(filename)}"
        ),
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
    }
    return Response(content=body, media_type=content_type, headers=headers)


@router.delete("/{expense_id}/receipt", response_model=Expense)
async def delete_receipt(
    expense_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """Remove o comprovante da despesa."""
    existing = await _get_family_expense(expense_id, current_user.family_id)
    object_key = _receipt_object_key(existing)
    if not object_key:
        raise HTTPException(status_code=404, detail="Comprovante não encontrado")

    db = await get_database()
    await db.expenses.update_one(
        {"_id": ObjectId(expense_id), "family_id": current_user.family_id},
        {"$unset": {"receipt": ""}, "$set": {"updated_at": datetime.now(UTC)}},
    )
    await asyncio.to_thread(s3_storage.delete_object, object_key)

    updated = await db.expenses.find_one({"_id": ObjectId(expense_id)})
    return await _to_expense_response(updated)


class PayInstallmentsRequest(BaseModel):
    payment_source: PaymentSource
    credit_card_name: str | None = None
    loan_name: str | None = None
    from_expense_id: str | None = None


class PayInstallmentsResult(BaseModel):
    updated: int
    open_amount: float


def _from_installment_forward(expense: dict, origin: dict | None) -> bool:
    """Parcela em aberto a partir da que está sendo quitada, inclusive."""
    if origin is None:
        return True
    if expense.get("_id") == origin.get("_id"):
        return True
    origin_number = origin.get("installment_number")
    number = expense.get("installment_number")
    if origin_number and number:
        return number >= origin_number
    origin_due = origin.get("due_date")
    due = expense.get("due_date")
    if origin_due and due:
        return due >= origin_due
    return True


class OpenInstallmentsPreview(BaseModel):
    count: int
    open_amount: float


async def _select_open_installments(group_id: str, from_expense_id: str | None, current_user: User):
    db = await get_database()
    origin = None
    if from_expense_id:
        if not ObjectId.is_valid(from_expense_id):
            raise HTTPException(status_code=400, detail="ID inválido")
        origin = await db.expenses.find_one(
            {
                "_id": ObjectId(from_expense_id),
                "family_id": current_user.family_id,
                "installment_group_id": group_id,
            }
        )
        if not origin:
            raise HTTPException(status_code=404, detail="Parcela não encontrada")

    open_expenses = await db.expenses.find(
        {
            "family_id": current_user.family_id,
            "installment_group_id": group_id,
            "status": {"$ne": ExpenseStatus.PAGO},
        }
    ).to_list(length=None)
    selected = [
        expense
        for expense in open_expenses
        if _from_installment_forward(expense, origin)
    ]
    if not selected:
        raise HTTPException(
            status_code=404, detail="Nenhuma parcela em aberto neste grupo"
        )
    open_amount = round(sum(float(expense.get("amount") or 0) for expense in selected), 2)
    return db, selected, open_amount


@router.get("/installments/{group_id}/open-amount", response_model=OpenInstallmentsPreview)
async def preview_installment_group(
    group_id: str,
    from_expense_id: str = Query(...),
    current_user: User = Depends(get_current_active_user),
):
    """Soma as parcelas em aberto a partir da parcela informada, sem quitar."""
    _db, selected, open_amount = await _select_open_installments(
        group_id, from_expense_id, current_user
    )
    return OpenInstallmentsPreview(count=len(selected), open_amount=open_amount)


@router.post("/installments/{group_id}/pay", response_model=PayInstallmentsResult)
async def pay_installment_group(
    group_id: str,
    body: PayInstallmentsRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Quita as parcelas em aberto a partir da parcela informada."""
    db, selected, open_amount = await _select_open_installments(
        group_id, body.from_expense_id, current_user
    )
    now = datetime.now(UTC)
    update = {
        "status": ExpenseStatus.PAGO,
        "payment_source": body.payment_source,
        "paid_at": now,
        "paid_by_user_id": current_user.id,
        "paid_by_name": current_user.full_name,
        "updated_at": now,
    }
    if body.payment_source == PaymentSource.CREDIT_CARD and body.credit_card_name:
        update["credit_card_name"] = body.credit_card_name.strip()
    if body.payment_source == PaymentSource.LOAN and body.loan_name:
        update["loan_name"] = body.loan_name.strip()

    await db.expenses.update_many(
        {"_id": {"$in": [expense["_id"] for expense in selected]}},
        {"$set": update},
    )
    return PayInstallmentsResult(updated=len(selected), open_amount=open_amount)


@router.delete("/installments/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_installment_group(
    group_id: str,
    only_open: bool = Query(True),
    current_user: User = Depends(get_current_active_user),
):
    """Deleta parcelas de um grupo. Se only_open=True, remove  em aberto.

    Mantém as parcelas já pagas,  em relatórios.
    """
    db = await get_database()

    # Busca parcelas do grupo que pertencem à família do usuário
    query = {
        "family_id": current_user.family_id,
        "installment_group_id": group_id,
    }
    if only_open:
        # Remove todas que não estão pagas (em aberto ou não pagas)
        query["status"] = {"$in": [ExpenseStatus.EM_ABERTO, ExpenseStatus.NAO_PAGO]}

    expenses_to_delete = await db.expenses.find(
        query, {"_id": 1, "receipt": 1}
    ).to_list(length=None)

    # Nenhuma parcela elegível: retorna 204 para manter idempotência
    if not expenses_to_delete:
        return None

    ids = [expense["_id"] for expense in expenses_to_delete]
    await db.expenses.delete_many({"_id": {"$in": ids}})

    for expense in expenses_to_delete:
        object_key = _receipt_object_key(expense)
        if object_key:
            await asyncio.to_thread(s3_storage.delete_object, object_key)

    return None


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: str, current_user: User = Depends(get_current_active_user)
):
    """Deleta uma despesa da família"""
    db = await get_database()

    if not ObjectId.is_valid(expense_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    existing = await db.expenses.find_one(
        {
            "_id": ObjectId(expense_id),
            "family_id": current_user.family_id,
        }
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

    result = await db.expenses.delete_one(
        {
            "_id": ObjectId(expense_id),
            "family_id": current_user.family_id,
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")

    object_key = _receipt_object_key(existing)
    if object_key:
        await asyncio.to_thread(s3_storage.delete_object, object_key)

    return None
