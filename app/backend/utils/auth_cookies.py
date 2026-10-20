from datetime import timedelta

from fastapi import Response

from config import settings

AUTH_COOKIE_NAME = "access_token"


def set_auth_cookie(
    response: Response, token: str, expires_delta: timedelta | None = None
) -> None:
    max_age = int(
        (
            expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
        ).total_seconds()
    )
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        secure=settings.auth_cookie_secure,
        samesite=settings.auth_cookie_samesite,
    )
