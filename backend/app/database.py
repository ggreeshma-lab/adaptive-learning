from collections.abc import Generator

from sqlalchemy import create_engine, text
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
    Base.metadata.create_all(bind=database_engine)
    with Session(database_engine) as session:
        seed_questions(session)


def check_database_connection(database_engine: Engine = engine) -> None:
    with database_engine.connect() as connection:
        connection.execute(text("SELECT 1"))
