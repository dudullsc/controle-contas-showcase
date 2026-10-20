def test_login_invalid_user(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "fake@example.com", "password": "wrongpass"},
    )
    assert response.status_code == 401
    assert "Email ou senha incorretos" in response.text


def test_forgot_password_not_found(client):
    response = client.post(
        "/api/auth/forgot-password", params={"email": "naoexiste@example.com"}
    )
    assert response.status_code == 200
    assert "Se o email estiver cadastrado" in response.json()["message"]


def test_forgot_password_inactive(client, monkeypatch):
    from unittest.mock import AsyncMock, MagicMock

    # Mock get_database para simular usuário inativo
    user_data = {
        "_id": "507f1f77bcf86cd799439011",
        "is_active": False,
    }

    mock_db = MagicMock()
    mock_db.users.find_one = AsyncMock(return_value=user_data)

    async def mock_get_database():
        return mock_db

    monkeypatch.setattr("routers.auth.get_database", mock_get_database)

    response = client.post(
        "/api/auth/forgot-password", params={"email": "inativo@example.com"}
    )
    assert response.status_code == 200
    assert "Se o email estiver cadastrado" in response.json()["message"]


def test_reset_password_invalid_token(client):
    response = client.post(
        "/api/auth/reset-password", params={"token": "fake", "new_password": "12345678"}
    )
    assert response.status_code == 400
    assert "Token inválido ou expirado" in response.text
