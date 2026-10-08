from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (Index("ix_questions_topic", "topic"),)

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    topic: Mapped[str] = mapped_column(String(100), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(String, nullable=False)
    options: Mapped[list[dict[str, str]]] = mapped_column(JSON, nullable=False)
    skill: Mapped[str] = mapped_column(String(100), nullable=False)
    correct_option_id: Mapped[str] = mapped_column(String(20), nullable=False)
    hints: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    misconception: Mapped[str] = mapped_column(String, nullable=False)
    breakdown: Mapped[str] = mapped_column(String, nullable=False)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (Index("ux_users_username_lower", text("lower(username)"), unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    username: Mapped[str] = mapped_column(String(32), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class Attempt(Base):
    __tablename__ = "attempts"
    __table_args__ = (Index("ix_attempts_user_created", "user_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[str] = mapped_column(
        ForeignKey("questions.id", ondelete="RESTRICT"), nullable=False
    )
    selected_option_id: Mapped[str] = mapped_column(String(20), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    elo_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
