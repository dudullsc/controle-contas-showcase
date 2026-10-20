import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# Define variáveis de ambiente ANTES de qualquer import
os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("DATABASE_NAME", "controle_contas_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "720")
os.environ.setdefault("AUTH_COOKIE_SECURE", "false")
os.environ.setdefault("AUTH_COOKIE_SAMESITE", "lax")
os.environ.setdefault("ENABLE_NOTIFICATIONS", "false")
os.environ.setdefault("WAHA_API_KEY", "test-key")
os.environ.setdefault("WAHA_BASE_URL", "http://waha:3000")
os.environ.setdefault("WAHA_SESSION", "default")
os.environ.setdefault("NOTIFICATION_CHECK_TIME", "09:00")

# Mock do módulo database ANTES de qualquer import
sys.modules["motor"] = MagicMock()
sys.modules["motor.motor_asyncio"] = MagicMock()


@pytest.fixture
def client(mock_db):
    """Cliente de teste para os endpoints"""
    from fastapi.testclient import TestClient

    import database

    # Garante que o db.client existe durante os testes
    database.db.client = MagicMock()
    database.db.client.__getitem__.return_value = mock_db

    # Mock do scheduler antes de importar main
    with patch("main.AsyncIOScheduler", MagicMock()):
        from main import app

        return TestClient(app)


@pytest.fixture
def mock_db():
    """Mock do banco de dados"""
    from unittest.mock import AsyncMock

    db = MagicMock()
    db.users = MagicMock()
    db.users.find_one = AsyncMock(return_value=None)
    db.users.find = MagicMock(
        return_value=MagicMock(to_list=AsyncMock(return_value=[]))
    )
    db.users.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id="test_id"))

    db.expenses = MagicMock()
    db.expenses.find = MagicMock(
        return_value=MagicMock(to_list=AsyncMock(return_value=[]))
    )
    db.expenses.find_one = AsyncMock(return_value=None)
    db.expenses.insert_one = AsyncMock(return_value=MagicMock(inserted_id="test_id"))
    db.expenses.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    db.debts = MagicMock()
    db.debts.find = MagicMock(
        return_value=MagicMock(to_list=AsyncMock(return_value=[]))
    )
    db.debts.find_one = AsyncMock(return_value=None)
    db.debts.insert_one = AsyncMock(return_value=MagicMock(inserted_id="test_id"))

    db.incomes = MagicMock()
    db.incomes.find = MagicMock(
        return_value=MagicMock(to_list=AsyncMock(return_value=[]))
    )
    db.incomes.find_one = AsyncMock(return_value=None)

    db.families = MagicMock()
    db.families.find = MagicMock(
        return_value=MagicMock(to_list=AsyncMock(return_value=[]))
    )
    db.families.find_one = AsyncMock(return_value=None)

    db.notification_history = MagicMock()
    db.notification_history.insert_one = AsyncMock(
        return_value=MagicMock(inserted_id="test_id")
    )

    db.access_logs = MagicMock()
    db.access_logs.insert_one = AsyncMock(
        return_value=MagicMock(inserted_id="test_log_id")
    )
    db.access_logs.count_documents = AsyncMock(return_value=0)
    db.access_logs.find = MagicMock(
        return_value=MagicMock(to_list=AsyncMock(return_value=[]))
    )

    return db


@pytest.fixture
def mock_motor_client(mocker):
    """Mock do cliente motor do MongoDB"""
    client = MagicMock()
    client.__getitem__ = MagicMock(return_value=MagicMock())
    return client
