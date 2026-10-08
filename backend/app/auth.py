import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

password_hash = PasswordHash.recommended()
SessionDependency = Annotated[Session, Depends(get_db)]


def _csrf_signature(token: str) -> str:
    return hmac.new(
        settings.auth_secret.encode(),
        token.encode(),
        hashlib.sha256,
    ).hexdigest()


def issue_csrf_cookie(response: Response) -> str:
    token = secrets.token_urlsafe(32)
    signed_token = f"{token}.{_csrf_signature(token)}"
    response.set_cookie(
        settings.csrf_cookie_name,
        signed_token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
        path="/",
    )
    return token


def require_csrf(request: Request) -> None:
    origin = request.headers.get("Origin")
    if origin not in settings.allowed_origins:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Untrusted request origin"
        )
    cookie_value = request.cookies.get(settings.csrf_cookie_name, "")
    header_value = request.headers.get("X-CSRF-Token", "")
    token, separator, signature = cookie_value.partition(".")
    if (
        not separator
        or not header_value
        or not hmac.compare_digest(token, header_value)
        or not hmac.compare_digest(signature, _csrf_signature(token))
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed")


def set_session_cookie(response: Response, user: User) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.session_ttl_seconds)
    token = jwt.encode(
        {"sub": user.id, "exp": expires_at},
        settings.auth_secret,
        algorithm="HS256",
    )
    response.set_cookie(
        settings.session_cookie_name,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
        path="/",
    )


def get_current_user(request: Request, session: SessionDependency) -> User:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")
    try:
        payload = jwt.decode(token, settings.auth_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not isinstance(user_id, str):
            raise jwt.InvalidTokenError("Missing subject")
    except jwt.InvalidTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired; please log in again",
        ) from error

    user = session.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
CsrfDependency = Annotated[None, Depends(require_csrf)]


def create_user(session: Session, username: str, password: str) -> User:
    user = User(username=username.lower(), password_hash=password_hash.hash(password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def verify_password(password: str, stored_hash: str) -> bool:
    return password_hash.verify(password, stored_hash)
