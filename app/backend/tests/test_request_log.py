import logging

import pytest


def test_logs_list_with_query(client, caplog):
    caplog.set_level(logging.INFO, logger="api.access")
    response = client.get("/api/version?token=segredo")
    assert response.status_code == 200
    messages = " ".join(record.message for record in caplog.records)
    assert "GET /api/version?token=*** -> 200" in messages
    assert "segredo" not in messages


def test_logs_successful_request(client, caplog):
    caplog.set_level(logging.INFO, logger="api.access")
    response = client.get("/api/version")
    assert response.status_code == 200
    assert any(
        "GET /api/version -> 200" in record.message for record in caplog.records
    )


def test_skips_health_probe(client, caplog):
    caplog.set_level(logging.INFO, logger="api.access")
    response = client.get("/health")
    assert response.status_code == 200
    assert not any("/health" in record.message for record in caplog.records)


def test_logs_http_error_detail(client, caplog):
    caplog.set_level(logging.INFO, logger="api.access")
    response = client.post(
        "/api/auth/login",
        data={"username": "ninguem@example.com", "password": "senha-errada"},
    )
    assert response.status_code in {400, 401, 422}
    messages = " ".join(record.message for record in caplog.records)
    assert "POST /api/auth/login" in messages
    assert "senha-errada" not in messages


@pytest.mark.parametrize(
    "payload",
    [{}],
)
def test_logs_validation_without_input_values(client, caplog, payload):
    caplog.set_level(logging.WARNING, logger="api.access")
    response = client.post("/api/auth/forgot-password", json=payload)
    assert response.status_code == 422
    messages = " ".join(record.message for record in caplog.records)
    assert "validação POST /api/auth/forgot-password" in messages
    assert "422" in messages
