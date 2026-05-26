import pytest


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_login_success(client, admin_user, mock_redis):
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "correctpassword"})
    assert r.status_code == 200
    assert r.json()["message"] == "Logged in successfully"
    assert "access_token" in r.cookies
    assert "refresh_token" in r.cookies


def test_login_wrong_password(client, admin_user, mock_redis):
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "wrongpassword"})
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "invalid_credentials"


def test_login_wrong_email(client, admin_user, mock_redis):
    r = client.post("/api/v1/auth/login", json={"email": "nobody@test.com", "password": "correctpassword"})
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "invalid_credentials"


def test_login_lockout(client, admin_user, mock_redis):
    mock_redis.get.return_value = "5"
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "wrong"})
    assert r.status_code == 429
    assert r.json()["detail"]["code"] == "locked_out"


def test_me_authenticated(client, admin_user, mock_redis):
    client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "correctpassword"})
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "admin@test.com"


def test_me_unauthenticated(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_logout(client, admin_user, mock_redis):
    client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "correctpassword"})
    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 200


def test_refresh(client, admin_user, mock_redis):
    client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "correctpassword"})
    mock_redis.get.return_value = "admin@test.com"
    r = client.post("/api/v1/auth/refresh")
    assert r.status_code == 200
    assert "access_token" in r.cookies
