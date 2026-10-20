from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from database import get_database
from models.user import User, UserRole
from utils.auth_cookies import AUTH_COOKIE_NAME
from utils.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


async def get_current_user(
    request: Request,
    bearer_token: str | None = Depends(oauth2_scheme),
) -> User:
    """Retorna o usuário atual baseado no JWT (header Bearer ou cookie HttpOnly)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = bearer_token or request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    email: str = payload.get("sub")
    user_id: str = payload.get("user_id")

    if email is None or user_id is None:
        raise credentials_exception

    db = await get_database()
    user_data = await db.users.find_one({"email": email})

    if user_data is None:
        raise credentials_exception

    user_data["_id"] = str(user_data["_id"])
    return User(**user_data)


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Verifica se o usuário está ativo"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo")
    return current_user


async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Verifica se o usuário é administrador (flag is_admin ou role admin/super)."""
    role = (
        current_user.role.value
        if isinstance(current_user.role, UserRole)
        else str(current_user.role or "")
    )
    if current_user.is_admin or role in {
        UserRole.USERADMIN.value,
        UserRole.USERADMINSUPER.value,
    }:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="Permissões insuficientes"
    )


async def get_current_super_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Verifica se o usuário é super administrador"""
    role = (
        current_user.role.value
        if isinstance(current_user.role, UserRole)
        else str(current_user.role or "")
    )
    if role == UserRole.USERADMINSUPER.value:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="Permissões insuficientes"
    )


async def get_current_admin_or_super(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Verifica se o usuário é admin ou super admin.
    Pode gerenciar usuários da família.
    """
    role = (
        current_user.role.value
        if isinstance(current_user.role, UserRole)
        else str(current_user.role or "")
    )
    if role in {
        UserRole.USERADMIN.value,
        UserRole.USERADMINSUPER.value,
    }:
        return current_user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            "Permissões insuficientes. "
            "Apenas administradores podem gerenciar usuários."
        ),
    )
