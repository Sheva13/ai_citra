from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_token, get_current_user, verify_password
from ..db import get_db
from ..models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=255)


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHENTICATED", "message": "Email atau password salah"},
        )
    token, expires_in = create_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "email": user.email,
        "expires_in": expires_in,
    }


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"email": user.email, "role": user.role}
