def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_version(client):
    response = client.get("/api/version")
    assert response.status_code == 200
    assert "version" in response.json()
    assert "build" in response.json()
