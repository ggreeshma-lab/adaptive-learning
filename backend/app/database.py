import re
from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL, Engine, make_url
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.models import Base
from app.seed import seed_questions


def _sqlalchemy_database_url(database_url: str) -> str | URL:
    url = make_url(database_url)
    if url.drivername in {"postgres", "postgresql"}:
        return url.set(drivername="postgresql+psycopg")
    return url


engine = create_engine(_sqlalchemy_database_url(settings.database_url), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


def initialize_database(database_engine: Engine = engine) -> None:
    _migrate_legacy_email_accounts(database_engine)
    Base.metadata.create_all(bind=database_engine)
    with Session(database_engine) as session:
        seed_questions(session)


def _migrate_legacy_email_accounts(database_engine: Engine) -> None:
    with database_engine.begin() as connection:
        if database_engine.dialect.name == "postgresql":
            connection.execute(text("SELECT pg_advisory_xact_lock(72120401, 1)"))

        inspector = inspect(connection)
        if not inspector.has_table("users"):
            return

        columns = {column["name"] for column in inspector.get_columns("users")}
        if "email" not in columns or "username" in columns:
            return

        email_indexes = [
            index["name"]
            for index in inspector.get_indexes("users")
            if "email" in index.get("column_names", [])
        ]
        for index_name in email_indexes:
            escaped_name = index_name.replace('"', '""')
            connection.execute(text(f'DROP INDEX "{escaped_name}"'))
        connection.execute(text("ALTER TABLE users RENAME COLUMN email TO username"))

        accounts = connection.execute(text("SELECT id, username FROM users ORDER BY id")).all()
        used_usernames: set[str] = set()
        for account_id, legacy_email in accounts:
            username = _legacy_username(legacy_email, used_usernames)
            connection.execute(
                text("UPDATE users SET username = :username WHERE id = :account_id"),
                {"username": username, "account_id": account_id},
            )
            used_usernames.add(username)

        connection.execute(
            text("CREATE UNIQUE INDEX ux_users_username_lower ON users (lower(username))")
        )


def _legacy_username(legacy_email: str, used_usernames: set[str]) -> str:
    local_part = legacy_email.partition("@")[0].lower()
    base = re.sub(r"[^a-z0-9_]", "_", local_part).strip("_")
    if len(base) < 3:
        base = f"user_{base}".strip("_")
    base = base[:32] or "user"

    candidate = base
    suffix = 1
    while candidate in used_usernames:
        suffix += 1
        suffix_text = str(suffix)
        candidate = f"{base[: 32 - len(suffix_text)]}{suffix_text}"
    return candidate


def check_database_connection(database_engine: Engine = engine) -> None:
    with database_engine.connect() as connection:
        connection.execute(text("SELECT 1"))
