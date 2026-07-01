from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from jose import JWTError
from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    rotate_refresh_token,
    revoke_refresh_token,
    decode_token,
    record_failed_attempt,
    is_locked_out,
    clear_failed_attempts,
    LOCKOUT_MAX_ATTEMPTS,
    hash_password,
    consume_password_reset_token,
)
from app.schemas.auth import LoginRequest, MeResponse, SignupRequest, ResetPasswordRequest
from app.services.auth import authenticate_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
COOKIE_OPTS = dict(httponly=True, samesite="lax", secure=False)


def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(ACCESS_COOKIE, access, max_age=1800, **COOKIE_OPTS)
    response.set_cookie(REFRESH_COOKIE, refresh, max_age=604800, **COOKIE_OPTS)


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE)
    response.delete_cookie(REFRESH_COOKIE)


def _get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = db.query(User).filter(User.email == payload["sub"]).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"

    if is_locked_out(ip):
        raise HTTPException(
            status_code=429,
            detail={"message": "Too many attempts. Try again in 15 minutes.", "code": "locked_out"},
        )

    user = authenticate_user(db, body.email, body.password)
    if not user:
        count = record_failed_attempt(ip)
        remaining = LOCKOUT_MAX_ATTEMPTS - count
        if remaining <= 0:
            raise HTTPException(
                status_code=429,
                detail={"message": "Too many attempts. Try again in 15 minutes.", "code": "locked_out"},
            )
        raise HTTPException(
            status_code=401,
            detail={"message": "Invalid email or password.", "code": "invalid_credentials"},
        )

    clear_failed_attempts(ip)
    access = create_access_token(user.email)
    refresh = create_refresh_token(user.email)
    _set_auth_cookies(response, access, refresh)
    return {"message": "Logged in successfully"}


@router.post("/signup", status_code=201)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if not settings.signup_invite_secret:
        raise HTTPException(
            status_code=403,
            detail={"message": "Sign up is not enabled.", "code": "signup_disabled"},
        )
    if body.invite_token != settings.signup_invite_secret:
        raise HTTPException(
            status_code=403,
            detail={"message": "Invalid invite link.", "code": "invalid_invite"},
        )
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"message": "An account with this email already exists.", "code": "email_exists"},
        )
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    db.commit()
    return {"message": "Account created. You can sign in now."}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = consume_password_reset_token(body.token)
    if not email:
        raise HTTPException(
            status_code=400,
            detail={"message": "This reset link is invalid or has expired.", "code": "invalid_token"},
        )
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail={"message": "User not found.", "code": "not_found"},
        )
    user.hashed_password = hash_password(body.password)
    db.commit()
    return {"message": "Password updated. You can sign in now."}


@router.post("/refresh")
def refresh(request: Request, response: Response):
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token expired")

    new_refresh = rotate_refresh_token(token)
    if not new_refresh:
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    new_access = create_access_token(payload["sub"])
    _set_auth_cookies(response, new_access, new_refresh)
    return {"message": "Token refreshed"}


@router.post("/logout")
def logout(response: Response, request: Request):
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        revoke_refresh_token(token)
    _clear_auth_cookies(response)
    response.delete_cookie("active_location_id")
    return {"message": "Logged out"}


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(_get_current_user)):
    return MeResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
    )
