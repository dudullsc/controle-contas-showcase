"""Log de todas as chamadas HTTP da API (criar, alterar, excluir e leitura)."""

import logging
import sys
import time
from urllib.parse import parse_qsl, urlencode

from fastapi import Request
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from utils.auth_cookies import AUTH_COOKIE_NAME
from utils.ip_utils import get_client_ip
from utils.security import decode_access_token

logger = logging.getLogger("api.access")
logger.setLevel(logging.INFO)
# O Uvicorn deixa o logger raiz em WARNING. Sem um handler próprio,
# as linhas INFO (requisições que deram certo) não aparecem no pod.
if not logger.handlers:
    _handler = logging.StreamHandler(sys.stderr)
    _handler.setLevel(logging.INFO)
    _handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [api] %(message)s")
    )
    logger.addHandler(_handler)

# Sonda do cluster. O restante, inclusive GET, entra no log.
_SKIP_PATHS = {"/health"}
_SENSITIVE_QUERY = {"password", "token", "access_token", "secret", "authorization"}


def _target(request: Request) -> str:
    """Caminho com query, sem senha nem token."""
    path = request.url.path
    pairs = []
    for key, value in parse_qsl(request.url.query, keep_blank_values=True):
        if key.lower() in _SENSITIVE_QUERY:
            pairs.append((key, "***"))
        else:
            pairs.append((key, value))
    if not pairs:
        return path
    return f"{path}?{urlencode(pairs, safe='*')}"


def _actor(request: Request) -> str:
    """Email do JWT, sem consultar o banco e sem registrar o token."""
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        header = request.headers.get("authorization") or ""
        if header.lower().startswith("bearer "):
            token = header[7:].strip()
    if not token:
        return "-"
    payload = decode_access_token(token)
    if not payload:
        return "token-invalido"
    return str(payload.get("sub") or "-")


def _validation_summary(errors: list) -> str:
    parts: list[str] = []
    for err in errors:
        if not isinstance(err, dict):
            continue
        loc = ".".join(
            str(part) for part in err.get("loc", []) if part not in ("body", "query")
        )
        msg = str(err.get("msg") or "").replace("Value error, ", "")
        parts.append(f"{loc}: {msg}" if loc else msg)
    return "; ".join(part for part in parts if part)[:500]


def _detail_text(detail: object) -> str:
    if isinstance(detail, str):
        return detail[:500]
    if isinstance(detail, list):
        return _validation_summary(detail) or "erro de validação"
    return "erro"


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS" or request.url.path in _SKIP_PATHS:
            return await call_next(request)

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.exception(
                "%s %s -> 500 %.0fms user=%s ip=%s",
                request.method,
                _target(request),
                elapsed_ms,
                _actor(request),
                get_client_ip(request),
            )
            raise

        elapsed_ms = (time.perf_counter() - started) * 1000
        status = response.status_code
        log = logger.warning if status >= 400 else logger.info
        log(
            "%s %s -> %s %.0fms user=%s ip=%s",
            request.method,
            _target(request),
            status,
            elapsed_ms,
            _actor(request),
            get_client_ip(request),
        )
        return response


async def log_http_exception(request: Request, exc: StarletteHTTPException):
    logger.warning(
        "falha %s %s status=%s detail=%s user=%s",
        request.method,
        request.url.path,
        exc.status_code,
        _detail_text(exc.detail),
        _actor(request),
    )
    return await http_exception_handler(request, exc)


async def log_validation_error(request: Request, exc: RequestValidationError):
    logger.warning(
        "validação %s %s status=422 detail=%s user=%s",
        request.method,
        request.url.path,
        _validation_summary(exc.errors()),
        _actor(request),
    )
    return await request_validation_exception_handler(request, exc)
