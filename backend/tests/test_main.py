import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import main
from app.database import _sqlalchemy_database_url, get_db, initialize_database
from app.models import Base

client = TestClient(main.app)
FRONTEND_ORIGIN = "http://localhost:5173"


def csrf_headers(test_client: TestClient) -> dict[str, str]:
    response = test_client.get("/api/auth/csrf", headers={"Origin": FRONTEND_ORIGIN})
    assert response.status_code == 200
    return {
        "Origin": FRONTEND_ORIGIN,
        "X-CSRF-Token": response.json()["csrf_token"],
    }


def register_user(test_client: TestClient, email: str = "learner@example.com") -> dict[str, str]:
    response = test_client.post(
        "/api/auth/register",
        json={"email": email, "password": "strong-pass-123"},
        headers=csrf_headers(test_client),
    )
    assert response.status_code == 200
    return response.json()


@pytest.fixture()
def question_client(monkeypatch):
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    initialize_database(test_engine)
    monkeypatch.setattr(main, "initialize_database", lambda: initialize_database(test_engine))

    def override_get_db():
        with Session(test_engine) as session:
            yield session

    main.app.dependency_overrides[get_db] = override_get_db
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


def test_health_check() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize(
    ("database_url", "expected_driver"),
    [
        ("postgres://user:pass@localhost/db", "postgresql+psycopg"),
        ("postgresql://user:pass@localhost/db", "postgresql+psycopg"),
        ("postgresql+psycopg://user:pass@localhost/db", "postgresql+psycopg"),
        ("sqlite:///./adaptiq.db", "sqlite"),
    ],
)
def test_database_url_uses_installed_postgres_driver(
    database_url: str,
    expected_driver: str,
) -> None:
    assert _sqlalchemy_database_url(database_url).drivername == expected_driver


def test_database_health_check_when_connected(monkeypatch) -> None:
    monkeypatch.setattr(main, "check_database_connection", lambda: None)

    response = client.get("/api/health/database")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_database_health_check_when_unavailable(monkeypatch) -> None:
    def fail_connection() -> None:
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    monkeypatch.setattr(main, "check_database_connection", fail_connection)

    response = client.get("/api/health/database")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


def test_generate_question_returns_question_without_answer(question_client) -> None:
    response = question_client.post(
        "/api/generate-question",
        json={"topic": "Python Data Structures", "elo": 1420, "exclude_ids": []},
    )

    assert response.status_code == 200
    question = response.json()
    assert question["id"] == "py-1"
    assert question["topic"] == "Python Data Structures"
    assert len(question["options"]) == 4
    assert "correct_option_id" not in question
    assert "hints" not in question
    assert "breakdown" not in question


def test_generate_question_avoids_excluded_questions(question_client) -> None:
    response = question_client.post(
        "/api/generate-question",
        json={"topic": "Python Data Structures", "elo": 1420, "exclude_ids": ["py-1"]},
    )

    assert response.status_code == 200
    assert response.json()["id"] == "py-2"


def test_generate_question_cycles_when_all_questions_were_seen(question_client) -> None:
    response = question_client.post(
        "/api/generate-question",
        json={"topic": "Python Data Structures", "elo": 1421, "exclude_ids": ["py-1", "py-2"]},
    )

    assert response.status_code == 200
    assert response.json()["id"] == "py-2"


def test_generate_question_rejects_unknown_topic(question_client) -> None:
    response = question_client.post(
        "/api/generate-question",
        json={"topic": "Unlisted topic", "elo": 1420, "exclude_ids": []},
    )

    assert response.status_code == 422


def test_register_login_session_and_logout(question_client) -> None:
    registration = question_client.post(
        "/api/auth/register",
        json={"email": "Learner@example.com", "password": "strong-pass-123"},
        headers=csrf_headers(question_client),
    )

    assert registration.status_code == 200
    assert registration.json()["email"] == "learner@example.com"
    assert "password_hash" not in registration.json()
    assert "httponly" in registration.headers["set-cookie"].lower()
    assert question_client.get("/api/auth/me").json()["id"] == registration.json()["id"]

    logout = question_client.post(
        "/api/auth/logout", json={}, headers=csrf_headers(question_client)
    )
    assert logout.status_code == 200
    assert question_client.get("/api/auth/me").status_code == 401

    login = question_client.post(
        "/api/auth/login",
        json={"email": "LEARNER@example.com", "password": "strong-pass-123"},
        headers=csrf_headers(question_client),
    )
    assert login.status_code == 200
    assert question_client.get("/api/auth/me").status_code == 200


def test_registration_rejects_duplicate_email(question_client) -> None:
    register_user(question_client)

    duplicate = question_client.post(
        "/api/auth/register",
        json={"email": "LEARNER@example.com", "password": "strong-pass-123"},
        headers=csrf_headers(question_client),
    )

    assert duplicate.status_code == 409


def test_mutating_auth_request_requires_csrf_and_allowed_origin(question_client) -> None:
    no_csrf = question_client.post(
        "/api/auth/register",
        json={"email": "learner@example.com", "password": "strong-pass-123"},
        headers={"Origin": FRONTEND_ORIGIN},
    )
    wrong_origin = question_client.post(
        "/api/auth/register",
        json={"email": "learner@example.com", "password": "strong-pass-123"},
        headers={**csrf_headers(question_client), "Origin": "https://attacker.example"},
    )

    assert no_csrf.status_code == 403
    assert wrong_origin.status_code == 403


def test_render_frontend_host_is_an_allowed_csrf_origin(question_client, monkeypatch) -> None:
    monkeypatch.setattr(main.settings, "frontend_host", "adaptiq-frontend.onrender.com")
    headers = csrf_headers(question_client)
    headers["Origin"] = "https://adaptiq-frontend.onrender.com"

    response = question_client.post(
        "/api/auth/register",
        json={"email": "render-learner@example.com", "password": "strong-pass-123"},
        headers=headers,
    )

    assert response.status_code == 200


def test_render_frontend_service_slug_adds_host_domain(question_client, monkeypatch) -> None:
    monkeypatch.setattr(main.settings, "frontend_host", "adaptiq-frontend")
    headers = csrf_headers(question_client)
    headers["Origin"] = "https://adaptiq-frontend.onrender.com"

    response = question_client.post(
        "/api/auth/register",
        json={"email": "render-slug@example.com", "password": "strong-pass-123"},
        headers=headers,
    )

    assert response.status_code == 200


def test_evaluate_answer_persists_attempt_and_returns_review_data(question_client) -> None:
    register_user(question_client)

    response = question_client.post(
        "/api/evaluate",
        json={"question_id": "py-1", "selected_option_id": "b"},
        headers=csrf_headers(question_client),
    )

    assert response.status_code == 200
    result = response.json()
    assert result["correct"] is False
    assert result["correctOptionId"] == "a"
    assert result["eloDelta"] == -10
    assert result["newElo"] == 1410
    assert result["misconception"] == "Treating hash-based containers like sequential lists"
    assert "**hash table**" in result["breakdown"]

    mastery = question_client.get("/api/mastery")
    assert mastery.status_code == 200
    assert mastery.json()["elo"] == 1410
    assert mastery.json()["totalAnswered"] == 1
    assert mastery.json()["categories"][0] == {"name": "Indexing", "score": 0}


def test_evaluate_rejects_unknown_question_and_invalid_option(question_client) -> None:
    register_user(question_client)

    unknown_question = question_client.post(
        "/api/evaluate",
        json={"question_id": "missing", "selected_option_id": "a"},
        headers=csrf_headers(question_client),
    )
    invalid_option = question_client.post(
        "/api/evaluate",
        json={"question_id": "py-1", "selected_option_id": "unknown"},
        headers=csrf_headers(question_client),
    )

    assert unknown_question.status_code == 404
    assert invalid_option.status_code == 422


def test_attempts_require_a_logged_in_user(question_client) -> None:
    response = question_client.post(
        "/api/evaluate",
        json={"question_id": "py-1", "selected_option_id": "a"},
        headers=csrf_headers(question_client),
    )

    assert response.status_code == 401
    assert question_client.get("/api/mastery").status_code == 401
    assert question_client.get("/api/hint?question_id=py-1&tier=1").status_code == 401


def test_ai_hint_requires_server_api_key(question_client, monkeypatch) -> None:
    register_user(question_client)
    monkeypatch.setattr(main.settings, "openai_api_key", None)

    response = question_client.get("/api/hint?question_id=py-1&tier=1")

    assert response.status_code == 503
    assert response.json()["detail"] == "AI tutor is not configured on the server"


def test_breakdown_requires_a_saved_attempt(question_client) -> None:
    register_user(question_client)

    response = question_client.get("/api/hint?question_id=py-1&tier=3")

    assert response.status_code == 403


def test_breakdown_streams_after_answer_submission(question_client) -> None:
    register_user(question_client)
    evaluation = question_client.post(
        "/api/evaluate",
        json={"question_id": "py-1", "selected_option_id": "b"},
        headers=csrf_headers(question_client),
    )
    assert evaluation.status_code == 200

    response = question_client.get("/api/hint?question_id=py-1&tier=3")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "**hash table**" in response.text
    assert "data: [DONE]" in response.text


def test_ai_hint_streams_provider_tokens(question_client, monkeypatch) -> None:
    register_user(question_client)
    monkeypatch.setattr(main.settings, "openai_api_key", "test-key")

    async def fake_stream(question, tier, selected_option_id):
        assert question.id == "py-1"
        assert tier == 2
        assert selected_option_id == "b"
        yield "Compare "
        yield "the operations."

    monkeypatch.setattr(main, "stream_socratic_hint", fake_stream)

    response = question_client.get("/api/hint?question_id=py-1&tier=2&selected=b")

    assert response.status_code == 200
    assert 'data: "Compare "\n\n' in response.text
    assert 'data: "the operations."\n\n' in response.text
    assert "data: [DONE]" in response.text


def test_attempts_and_mastery_are_isolated_per_user(question_client) -> None:
    register_user(question_client)
    wrong_answer = question_client.post(
        "/api/evaluate",
        json={"question_id": "py-1", "selected_option_id": "b"},
        headers=csrf_headers(question_client),
    )
    assert wrong_answer.status_code == 200

    question_client.post("/api/auth/logout", json={}, headers=csrf_headers(question_client))
    register_user(question_client, "second@example.com")
    mastery = question_client.get("/api/mastery")

    assert mastery.status_code == 200
    assert mastery.json()["elo"] == 1420
    assert mastery.json()["totalAnswered"] == 0
    assert mastery.json()["misconceptions"] == []
