"""Teste local do fluxo HttpOnly cookie (sem expor credenciais reais)."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

import requests
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from config import settings
from utils.security import get_password_hash

BASE_PROXY = "http://localhost:3000/api"
BASE_DIRECT = "http://localhost:8000/api"
TEST_EMAIL = f"httponly-test-{uuid.uuid4().hex[:8]}@local.test"
TEST_PASSWORD = "TestHttpOnly123!"


def ok(label: str, condition: bool, detail: str = "") -> bool:
    status = "OK" if condition else "FAIL"
    extra = f" — {detail}" if detail else ""
    print(f"[{status}] {label}{extra}")
    return condition


def main() -> int:
    print("=== Teste HttpOnly Cookie (localhost) ===\n")
    passed = 0
    total = 0

    # Setup: usuário temporário no MongoDB
    client = MongoClient(settings.mongodb_url)
    db = client[settings.database_name]
    db.users.insert_one(
        {
            "email": TEST_EMAIL,
            "hashed_password": get_password_hash(TEST_PASSWORD),
            "full_name": "HttpOnly Test",
            "is_active": True,
            "role": "USER",
        }
    )

    try:
        s = requests.Session()
        s.headers.update({"Content-Type": "application/x-www-form-urlencoded"})

        total += 1
        if ok("Proxy Next /api/version", requests.get(f"{BASE_PROXY}/version", timeout=10).status_code == 200):
            passed += 1

        total += 1
        if ok("/users/me sem login retorna 401", s.get(f"{BASE_PROXY}/users/me", timeout=10).status_code == 401):
            passed += 1

        total += 1
        bad = s.post(
            f"{BASE_PROXY}/auth/login",
            data={"username": "naoexiste@local.test", "password": "wrong"},
            timeout=10,
        )
        if ok("Login inválido retorna 401", bad.status_code == 401) and ok(
            "Login inválido não seta cookie",
            "access_token" not in bad.headers.get("set-cookie", "").lower(),
        ):
            passed += 1

        login = s.post(
            f"{BASE_PROXY}/auth/login",
            data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10,
        )
        set_cookie = login.headers.get("set-cookie", "")
        total += 1
        if ok("Login retorna 200", login.status_code == 200) and ok(
            "Set-Cookie contém access_token", "access_token" in set_cookie.lower()
        ) and ok("Cookie é HttpOnly", "httponly" in set_cookie.lower()):
            passed += 1

        me = s.get(f"{BASE_PROXY}/users/me", timeout=10)
        total += 1
        if ok("/users/me autenticado via cookie (sem Bearer)", me.status_code == 200):
            passed += 1

        logout = s.post(f"{BASE_PROXY}/auth/logout", timeout=10)
        total += 1
        if ok("Logout retorna 200", logout.status_code == 200):
            passed += 1

        me_after = s.get(f"{BASE_PROXY}/users/me", timeout=10)
        total += 1
        if ok("/users/me após logout retorna 401", me_after.status_code == 401):
            passed += 1

        # Compat Bearer (testes automatizados / API clients)
        login_direct = requests.post(
            f"{BASE_DIRECT}/auth/login",
            data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=10,
        )
        bearer = login_direct.json().get("access_token", "")
        bearer_me = requests.get(
            f"{BASE_DIRECT}/users/me",
            headers={"Authorization": f"Bearer {bearer}"},
            timeout=10,
        )
        total += 1
        if ok("Bearer header ainda funciona (compat)", bearer_me.status_code == 200):
            passed += 1

    finally:
        db.users.delete_one({"email": TEST_EMAIL})
        client.close()

    print(f"\n=== Resultado: {passed}/{total} testes passaram ===")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
