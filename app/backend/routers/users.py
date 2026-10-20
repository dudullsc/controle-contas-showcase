from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from database import get_database
from models.user import User, UserCreate, UserRole, UserUpdate
from utils.deps import get_current_active_user, get_current_admin_or_super
from utils.security import get_password_hash

router = APIRouter(prefix="/users", tags=["Usuários"])


@router.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Retorna informações do usuário atual"""
    return current_user


@router.get("/", response_model=list[User])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
):
    """Lista usuários da família (todos os usuários podem ver sua família)"""
    db = await get_database()
    if current_user.role == UserRole.USERADMINSUPER.value:
        # Superadmin enxerga todos os usuários
        users = await db.users.find({}).skip(skip).limit(limit).to_list(length=limit)
    else:
        # Usuários comuns e admins enxergam apenas sua família,
        # mas NUNCA veem superadmins
        users = (
            await db.users.find(
                {
                    "family_id": current_user.family_id,
                    # Exclui superadmins
                    "role": {"$ne": UserRole.USERADMINSUPER.value},
                }
            )
            .skip(skip)
            .limit(limit)
            .to_list(length=limit)
        )

    for user in users:
        user["_id"] = str(user["_id"])

    return [User(**user) for user in users]


@router.put("/me", response_model=User)
async def update_my_profile(
    user_update: UserUpdate, current_user: User = Depends(get_current_active_user)
):
    """Atualiza o perfil do usuário atual.
    Não permite alterar is_admin ou is_active.
    """
    db = await get_database()

    update_data = user_update.model_dump(exclude_unset=True)

    # Não permitir que o usuário altere is_admin, is_active ou WhatsApp
    update_data.pop("is_admin", None)
    update_data.pop("is_active", None)
    update_data.pop("whatsapp_notifications_enabled", None)

    # Se está tentando mudar a senha, precisa validar a senha atual
    if "password" in update_data:
        current_password = update_data.pop("current_password", None)

        if not current_password:
            raise HTTPException(
                status_code=400, detail="Senha atual é obrigatória para alterar a senha"
            )

        # Buscar usuário com senha hasheada para validar
        user_db = await db.users.find_one({"_id": ObjectId(current_user.id)})
        if not user_db:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        # Verificar se a senha atual está correta
        from utils.security import verify_password

        if not verify_password(current_password, user_db["hashed_password"]):
            raise HTTPException(status_code=400, detail="Senha atual incorreta")

        # Se a senha atual está correta, hashear a nova senha
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    # Remover current_password se ainda estiver no update_data
    update_data.pop("current_password", None)

    if update_data:
        update_data["updated_at"] = datetime.now(UTC)
        await db.users.update_one(
            {"_id": ObjectId(current_user.id)}, {"$set": update_data}
        )

    updated_user = await db.users.find_one({"_id": ObjectId(current_user.id)})
    if not updated_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    updated_user["_id"] = str(updated_user["_id"])
    return User(**updated_user)


@router.get("/{user_id}", response_model=User)
async def get_user(
    user_id: str, current_user: User = Depends(get_current_admin_or_super)
):
    """Busca um usuário da família (somente se for da mesma família)"""
    db = await get_database()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Verificar se o usuário é da mesma família
    if user.get("family_id") != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para acessar este usuário",
        )

    user["_id"] = str(user["_id"])
    return User(**user)


@router.put("/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_admin_or_super),
):
    """Atualiza um usuário da família"""
    db = await get_database()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    user_to_update = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_to_update:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Permissão: superadmin pode alterar qualquer usuário; admin só sua família
    if current_user.role != UserRole.USERADMINSUPER.value:
        if user_to_update.get("family_id") != current_user.family_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para atualizar este usuário",
            )

    update_data = user_update.model_dump(exclude_unset=True)

    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    if update_data:
        update_data["updated_at"] = datetime.now(UTC)
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})

    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not updated_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    updated_user["_id"] = str(updated_user["_id"])
    return User(**updated_user)


@router.post("/", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(
    user: UserCreate, current_user: User = Depends(get_current_admin_or_super)
):
    """Cria um novo usuário na família selecionada ou do admin"""
    db = await get_database()

    # Verifica se o email já existe
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email já cadastrado"
        )

    # Determina qual family_id usar
    if current_user.role == UserRole.USERADMINSUPER.value:
        # Superadmin pode criar em qualquer família
        if user.family_id:
            # Valida se a família existe
            family = await db.families.find_one({"_id": user.family_id})
            if not family:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Família selecionada não existe",
                )
            target_family_id = user.family_id
        else:
            # Se não informou, usa a família do superadmin
            if not current_user.family_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Informe a família ou configure sua própria",
                )
            target_family_id = current_user.family_id
    else:
        # Admin normal só pode criar na própria família
        if not current_user.family_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin sem família associada",
            )
        target_family_id = current_user.family_id

    # Cria o usuário
    user_dict = user.model_dump(exclude={"password", "family_id"})
    user_dict["hashed_password"] = get_password_hash(user.password)
    user_dict["family_id"] = target_family_id
    user_dict["role"] = user.role.value if user.role else UserRole.USER.value
    user_dict["created_at"] = datetime.now(UTC)
    user_dict["updated_at"] = datetime.now(UTC)

    result = await db.users.insert_one(user_dict)
    created_user = await db.users.find_one({"_id": result.inserted_id})
    created_user["_id"] = str(created_user["_id"])

    return User(**created_user)


@router.put("/me/salary", response_model=User)
async def update_my_salary(
    monthly_salary: float = Query(..., gt=0, description="Salário mensal"),
    salary_payment_day: int = Query(5, ge=1, le=31, description="Dia do pagamento"),
    current_user: User = Depends(get_current_active_user),
):
    """Atualiza o salário do usuário atual"""
    db = await get_database()

    update_data = {
        "monthly_salary": monthly_salary,
        "salary_payment_day": salary_payment_day,
        "updated_at": datetime.now(UTC),
    }

    await db.users.update_one({"_id": ObjectId(current_user.id)}, {"$set": update_data})

    updated_user = await db.users.find_one({"_id": ObjectId(current_user.id)})
    if not updated_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    updated_user["_id"] = str(updated_user["_id"])
    return User(**updated_user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str, current_user: User = Depends(get_current_admin_or_super)
):
    """Deleta um usuário e todos os dados relacionados.
    Remove despesas, dívidas, etc.
    Permissão: superadmin pode deletar qualquer usuário; admin só sua família
    """
    db = await get_database()

    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    user_to_delete = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Permissão: superadmin pode deletar qualquer usuário; admin só sua família
    if current_user.role != UserRole.USERADMINSUPER.value:
        if user_to_delete.get("family_id") != current_user.family_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Você não tem permissão para deletar este usuário",
            )

    # Cascade delete - deletar todos os dados relacionados ao usuário
    # 1. Deletar todas as despesas do usuário
    expenses_result = await db.expenses.delete_many({"user_id": user_id})

    # 2. Deletar todas as dívidas do usuário
    debts_result = await db.debts.delete_many({"user_id": user_id})

    # 3. Deletar tokens de reset de senha do usuário
    await db.password_reset_tokens.delete_many({"user_id": user_id})

    # 4. Finalmente, deletar o usuário
    result = await db.users.delete_one({"_id": ObjectId(user_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Log do que foi deletado (opcional, para auditoria)
    print(f"Usuário {user_id} deletado com sucesso:")
    print(f"  - Despesas deletadas: {expenses_result.deleted_count}")
    print(f"  - Dívidas deletadas: {debts_result.deleted_count}")

    return None
