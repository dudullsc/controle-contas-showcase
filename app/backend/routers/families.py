from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from database import get_database
from models.family import Family, FamilyCreate, FamilyUpdate
from models.user import User, UserRole
from utils.deps import get_current_active_user, get_current_super_admin

router = APIRouter(prefix="/families", tags=["Famílias"])


def _normalize_family_doc(doc: dict) -> dict:
    """Normaliza documentos antigos/novos para o schema atual da API."""
    if not doc:
        return doc

    try:
        _id = doc.get("_id")
        # Garante string para o _id
        if isinstance(_id, ObjectId):
            _id = str(_id)
        elif _id is None:
            _id = "unknown"
        else:
            _id = str(_id)

        # Campos compatíveis
        name = doc.get("name") or doc.get("nome") or "Família (sem nome)"
        description = doc.get("description")
        owner_cpf = doc.get("owner_cpf")

        # Processa datas com segurança
        created_at = doc.get("created_at") or doc.get("criado_em")
        if created_at and not isinstance(created_at, datetime):
            try:
                # Tenta converter se for string
                if isinstance(created_at, str):
                    from dateutil import parser

                    created_at = parser.parse(created_at)
                else:
                    created_at = datetime.utcnow()
            except Exception as e:
                print(f"Erro ao processar created_at: {e}")
                created_at = datetime.utcnow()

        if not created_at:
            created_at = datetime.utcnow()

        updated_at = doc.get("updated_at") or doc.get("criado_em")
        if updated_at and not isinstance(updated_at, datetime):
            try:
                if isinstance(updated_at, str):
                    from dateutil import parser

                    updated_at = parser.parse(updated_at)
                else:
                    updated_at = datetime.utcnow()
            except Exception as e:
                print(f"Erro ao processar updated_at: {e}")
                updated_at = datetime.utcnow()

        if not updated_at:
            updated_at = datetime.utcnow()

        result = {
            "_id": _id,
            "name": str(name) if name else "Família",
            "description": str(description) if description else None,
            "owner_cpf": str(owner_cpf) if owner_cpf else None,
            "created_at": created_at,
            "updated_at": updated_at,
        }

        return result

    except Exception as e:
        print(f"ERRO ao normalizar família: {type(e).__name__}: {str(e)}")
        print(f"Doc original: {doc}")
        import traceback

        traceback.print_exc()

        # Retorna um doc mínimo válido em caso de erro
        try:
            _id = str(doc.get("_id", "unknown"))
        except Exception:
            _id = "unknown"

        return {
            "_id": _id,
            "name": "Família (erro na leitura)",
            "description": None,
            "owner_cpf": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }


async def _load_family_or_404(db, family_id: str) -> dict:
    try:
        # Tenta por string literal
        family = await db.families.find_one({"_id": family_id})
        # Se não encontrou, tenta por ObjectId (dados antigos)
        if not family and ObjectId.is_valid(family_id):
            family = await db.families.find_one({"_id": ObjectId(family_id)})
        if not family:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Família não encontrada"
            )
        return _normalize_family_doc(family)
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERRO em _load_family_or_404: {type(e).__name__}: {str(e)}")
        print(f"family_id: {family_id}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao buscar família: {str(e)}",
        )


@router.get("/", response_model=list[Family])
async def list_families(current_user: User = Depends(get_current_active_user)):
    """Lista famílias. Superadmin vê todas; demais veem apenas a própria."""
    db = await get_database()

    try:
        if current_user.role == UserRole.USERADMINSUPER:
            families = await db.families.find().to_list(length=None)
            qty = len(families)
            print(
                f"[list_families] Superadmin {current_user.email} "
                f"listando {qty} famílias"
            )
        elif current_user.family_id:
            try:
                family = await _load_family_or_404(db, current_user.family_id)
                families = [family]
                print(
                    f"[list_families] Usuário {current_user.email} "
                    f"(family_id={current_user.family_id}) "
                    f"carregou sua família"
                )
            except HTTPException as he:
                print(
                    f"[list_families] Família {current_user.family_id} "
                    f"não encontrada para usuário {current_user.email}: "
                    f"{he.detail}"
                )
                families = []
        else:
            print(f"[list_families] Usuário {current_user.email} sem family_id")
            families = []

        # Normalizar com segurança
        normalized = []
        for i, fam in enumerate(families):
            try:
                norm = _normalize_family_doc(fam)
                normalized.append(norm)
            except Exception as e:
                print(f"[list_families] Erro ao normalizar família #{i}: {str(e)}")
                # Skip problematic families ao invés de falhar tudo
                continue

        print(f"[list_families] Retornando {len(normalized)} famílias normalizadas")
        return [Family(**fam) for fam in normalized]

    except HTTPException:
        raise
    except Exception as e:
        print(f"[list_families] ERRO CRÍTICO: {type(e).__name__}: {str(e)}")
        print(
            f"[list_families] Usuário: {current_user.email}, "
            f"family_id: {current_user.family_id}, "
            f"role: {current_user.role}"
        )
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar famílias: {str(e)}",
        )


@router.get("/{family_id}", response_model=Family)
async def get_family(
    family_id: str, current_user: User = Depends(get_current_active_user)
):
    """Retorna detalhes de uma família, respeitando escopo."""
    db = await get_database()

    if (
        current_user.role != UserRole.USERADMINSUPER
        and current_user.family_id != family_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Somente sua família"
        )

    family = await _load_family_or_404(db, family_id)
    return Family(**family)


@router.post("/", response_model=Family, status_code=status.HTTP_201_CREATED)
async def create_family(
    family: FamilyCreate, current_user: User = Depends(get_current_super_admin)
):
    """Cria uma nova família (apenas superadmin)."""
    db = await get_database()

    # Usa o CPF como ID da família (obrigatório)
    family_id = family.owner_cpf

    existing = await db.families.find_one({"_id": family_id})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Família já existe"
        )

    now = datetime.utcnow()
    family_doc = {
        "_id": family_id,
        "name": family.name,
        "description": family.description,
        "owner_cpf": family.owner_cpf,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.email,
    }

    await db.families.insert_one(family_doc)
    family_doc["_id"] = str(family_id)
    return Family(**family_doc)


@router.put("/{family_id}", response_model=Family)
async def update_family(
    family_id: str,
    family_update: FamilyUpdate,
    current_user: User = Depends(get_current_super_admin),
):
    """Atualiza dados de uma família (apenas superadmin)."""
    db = await get_database()

    update_data = family_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    result = await db.families.update_one({"_id": family_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Família não encontrada"
        )

    updated_family = await _load_family_or_404(db, family_id)
    return Family(**updated_family)


@router.delete("/{family_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_family(
    family_id: str, current_user: User = Depends(get_current_super_admin)
):
    """Remove uma família se não houver usuários vinculados.
    Apenas superadmin pode executar.
    """
    db = await get_database()

    linked_users = await db.users.count_documents({"family_id": family_id})
    if linked_users > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Família possui usuários vinculados",
        )

    result = await db.families.delete_one({"_id": family_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Família não encontrada"
        )

    return None


@router.get("/list/available", response_model=list[Family])
async def list_available_families(
    current_user: User = Depends(get_current_active_user),
):
    """
    Lista famílias disponíveis para o usuário.
    - Superadmin: vê todas as famílias
    - Admin: vê apenas sua própria família
    - Usuário comum: vê apenas sua própria família
    """
    db = await get_database()

    try:
        if current_user.role == UserRole.USERADMINSUPER:
            # Superadmin vê todas
            families = await db.families.find().to_list(length=None)
        elif current_user.family_id:
            # Outros veem apenas sua
            try:
                family = await _load_family_or_404(db, current_user.family_id)
                families = [family]
            except HTTPException:
                # Se a família não existe, retorna lista vazia
                print(
                    f"AVISO: Família {current_user.family_id} "
                    f"não encontrada para usuário {current_user.email}"
                )
                families = []
        else:
            # Usuário sem família retorna lista vazia
            print(f"AVISO: Usuário {current_user.email} sem family_id")
            families = []

        normalized = [_normalize_family_doc(fam) for fam in families]
        return [Family(**fam) for fam in normalized]
    except Exception as e:
        print(f"ERRO em list_available_families: {type(e).__name__}: {str(e)}")
        print(
            f"Usuário: {current_user.email}, "
            f"family_id: {current_user.family_id}, "
            f"role: {current_user.role}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao listar famílias disponíveis: {str(e)}",
        )
