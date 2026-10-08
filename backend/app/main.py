import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import APIRouter, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from openai import APIError
from sqlalchemy import Integer, func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.responses import StreamingResponse

from app.ai_tutor import stream_socratic_hint
from app.auth import (
    CsrfDependency,
    CurrentUser,
    SessionDependency,
    create_user,
    issue_csrf_cookie,
    set_session_cookie,
    verify_password,
)
from app.config import settings
from app.database import check_database_connection, initialize_database
from app.models import Attempt, Question, User
from app.schemas import (
    CredentialsRequest,
    EvaluationRequest,
    EvaluationResponse,
    GenerateQuestionRequest,
    MasteryCategory,
    MasteryResponse,
    QuestionResponse,
    UserResponse,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    initialize_database()
    yield


app = FastAPI(title="AdaptIQ API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")


@api_router.get("/auth/csrf")
def get_csrf_token(response: Response) -> dict[str, str]:
    return {"csrf_token": issue_csrf_cookie(response)}


@api_router.post("/auth/register", response_model=UserResponse)
def register(
    credentials: CredentialsRequest,
    response: Response,
    _: CsrfDependency,
    session: SessionDependency,
) -> User:
    try:
        user = create_user(session, credentials.username, credentials.password)
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(
            status_code=409, detail="An account with this username already exists"
        ) from error
    set_session_cookie(response, user)
    return user


@api_router.post("/auth/login", response_model=UserResponse)
def login(
    credentials: CredentialsRequest,
    response: Response,
    _: CsrfDependency,
    session: SessionDependency,
) -> User:
    user = session.scalar(select(User).where(User.username == credentials.username))
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    set_session_cookie(response, user)
    return user


@api_router.post("/auth/logout")
def logout(response: Response, _: CsrfDependency) -> dict[str, str]:
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")
    return {"status": "ok"}


@api_router.get("/auth/me", response_model=UserResponse)
def current_user(user: CurrentUser) -> User:
    return user


@api_router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@api_router.post("/generate-question", response_model=QuestionResponse)
def generate_question(
    request: GenerateQuestionRequest,
    session: SessionDependency,
) -> Question:
    questions = session.scalars(
        select(Question).where(Question.topic == request.topic).order_by(Question.id)
    ).all()
    if not questions:
        raise HTTPException(status_code=404, detail="No questions available for this topic")

    excluded = set(request.exclude_ids)
    unseen_questions = [question for question in questions if question.id not in excluded]
    if unseen_questions:
        return unseen_questions[0]

    return questions[request.elo % len(questions)]


@api_router.post("/evaluate", response_model=EvaluationResponse)
def evaluate_answer(
    request: EvaluationRequest,
    _: CsrfDependency,
    user: CurrentUser,
    session: SessionDependency,
) -> EvaluationResponse:
    question = session.get(Question, request.question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    if request.selected_option_id not in {option["id"] for option in question.options}:
        raise HTTPException(
            status_code=422, detail="Selected option is not valid for this question"
        )

    correct = request.selected_option_id == question.correct_option_id
    elo_delta = 12 + question.difficulty * 2 if correct else -(8 + question.difficulty)
    attempt = Attempt(
        user_id=user.id,
        question_id=question.id,
        selected_option_id=request.selected_option_id,
        is_correct=correct,
        elo_delta=elo_delta,
    )
    session.add(attempt)
    session.commit()

    total_delta = session.scalar(
        select(func.coalesce(func.sum(Attempt.elo_delta), 0)).where(Attempt.user_id == user.id)
    )
    return EvaluationResponse(
        correct=correct,
        correct_option_id=question.correct_option_id,
        elo_delta=elo_delta,
        new_elo=1420 + int(total_delta or 0),
        misconception=None if correct else question.misconception,
        breakdown=question.breakdown,
    )


@api_router.get("/mastery", response_model=MasteryResponse)
def get_mastery(user: CurrentUser, session: SessionDependency) -> MasteryResponse:
    category_rows = session.execute(
        select(
            Question.skill,
            func.count(Attempt.id),
            func.coalesce(func.sum(func.cast(Attempt.is_correct, Integer)), 0),
        )
        .outerjoin(
            Attempt,
            (Attempt.question_id == Question.id) & (Attempt.user_id == user.id),
        )
        .group_by(Question.skill)
        .order_by(Question.skill)
    ).all()
    categories = [
        MasteryCategory(
            name=skill,
            score=round(correct / total * 100) if total else 0,
        )
        for skill, total, correct in category_rows
    ]

    attempts = session.scalars(
        select(Attempt)
        .where(Attempt.user_id == user.id)
        .order_by(Attempt.created_at.desc(), Attempt.id.desc())
    ).all()
    misconceptions = session.scalars(
        select(Question.misconception)
        .join(Attempt, Attempt.question_id == Question.id)
        .where(Attempt.user_id == user.id, Attempt.is_correct.is_(False))
        .order_by(Attempt.created_at.desc(), Attempt.id.desc())
        .limit(20)
    ).all()
    unique_misconceptions = list(dict.fromkeys(misconceptions))[:5]
    category_scores = {category.name: category.score for category in categories}
    next_steps = [
        f"Practice {skill}"
        for skill, score in sorted(category_scores.items(), key=lambda item: item[1])
        if score < 80
    ][:3]
    streak = 0
    for attempt in attempts:
        if not attempt.is_correct:
            break
        streak += 1

    total_delta = sum(attempt.elo_delta for attempt in attempts)
    return MasteryResponse(
        elo=1420 + total_delta,
        categories=categories,
        misconceptions=unique_misconceptions,
        next_steps=next_steps,
        streak=streak,
        total_answered=len(attempts),
    )


@api_router.get("/hint")
async def get_hint(
    user: CurrentUser,
    session: SessionDependency,
    question_id: Annotated[str, Query(min_length=1, max_length=80)],
    tier: Annotated[int, Query(ge=1, le=3)],
    selected_option_id: Annotated[str | None, Query(alias="selected")] = None,
) -> StreamingResponse:
    question = session.get(Question, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    if selected_option_id is not None and selected_option_id not in {
        option["id"] for option in question.options
    }:
        raise HTTPException(
            status_code=422, detail="Selected option is not valid for this question"
        )

    if tier == 3:
        has_attempt = session.scalar(
            select(Attempt.id)
            .where(
                Attempt.user_id == user.id,
                Attempt.question_id == question.id,
            )
            .limit(1)
        )
        if has_attempt is None:
            raise HTTPException(
                status_code=403,
                detail="Submit an answer before viewing the step-by-step breakdown",
            )

        async def breakdown_stream() -> AsyncIterator[str]:
            for line in question.breakdown.splitlines(keepends=True):
                yield f"data: {json.dumps(line)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            breakdown_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="AI tutor is not configured on the server")

    async def hint_stream() -> AsyncIterator[str]:
        try:
            async for token in stream_socratic_hint(question, tier, selected_option_id):
                yield f"data: {json.dumps(token)}\n\n"
        except APIError:
            logger.exception("AI tutor streaming failed")
            yield 'event: error\ndata: "Tutor service is temporarily unavailable."\n\n'
            return
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        hint_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@api_router.get("/health/database")
def database_health_check() -> dict[str, str]:
    try:
        check_database_connection()
    except SQLAlchemyError as error:
        logger.exception("Database health check failed")
        raise HTTPException(status_code=503, detail="Database unavailable") from error
    return {"status": "ok", "database": "connected"}


app.include_router(api_router)
