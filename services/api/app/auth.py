import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

ALGORITHM = "HS256"
PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt, digest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        computed = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iterations)
        )
        return hmac.compare_digest(computed.hex(), digest)
    except Exception:
        return False


def create_token(user: User) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    expires_in = settings.jwt_expire_minutes * 60
    payload = {
        "sub": user.email,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
    return token, expires_in


def decode_token(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def _extract_token(request: Request, token_query: str | None) -> str | None:
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return token_query


def unauthenticated() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail={"code": "UNAUTHENTICATED", "message": "Sesi tidak valid, silakan masuk lagi"},
    )


def get_current_user(
    request: Request,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> User:
    raw = _extract_token(request, token)
    payload = decode_token(raw)
    if payload is None:
        raise unauthenticated()
    user = db.scalar(select(User).where(User.email == payload.get("sub")))
    if user is None:
        raise unauthenticated()
    return user


def require_role(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail={"code": "FORBIDDEN", "message": "Akses ditolak untuk role ini"},
            )
        return user

    return checker
