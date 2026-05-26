from datetime import datetime, timedelta, timezone
from typing import Optional
import redis as redis_lib
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_redis: Optional[redis_lib.Redis] = None

LOCKOUT_MAX_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 900  # 15 minutes
LOCKOUT_PREFIX = "login_lockout:"
REFRESH_TOKEN_PREFIX = "refresh_token:"


def get_redis() -> redis_lib.Redis:
    global _redis
    if _redis is None:
        _redis = redis_lib.from_url(settings.redis_url, decode_responses=True)
    return _redis


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": "access"},
        settings.secret_key,
        algorithm="HS256",
    )


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    token = jwt.encode(
        {"sub": subject, "exp": expire, "type": "refresh"},
        settings.secret_key,
        algorithm="HS256",
    )
    r = get_redis()
    ttl = settings.refresh_token_expire_days * 86400
    r.setex(f"{REFRESH_TOKEN_PREFIX}{token}", ttl, subject)
    return token


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=["HS256"])


def rotate_refresh_token(old_token: str) -> Optional[str]:
    r = get_redis()
    subject = r.get(f"{REFRESH_TOKEN_PREFIX}{old_token}")
    if not subject:
        return None
    r.delete(f"{REFRESH_TOKEN_PREFIX}{old_token}")
    return create_refresh_token(subject)


def revoke_refresh_token(token: str) -> None:
    get_redis().delete(f"{REFRESH_TOKEN_PREFIX}{token}")


def record_failed_attempt(ip: str) -> int:
    r = get_redis()
    key = f"{LOCKOUT_PREFIX}{ip}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, LOCKOUT_DURATION_SECONDS)
    return count


def is_locked_out(ip: str) -> bool:
    r = get_redis()
    count = r.get(f"{LOCKOUT_PREFIX}{ip}")
    return count is not None and int(count) >= LOCKOUT_MAX_ATTEMPTS


def clear_failed_attempts(ip: str) -> None:
    get_redis().delete(f"{LOCKOUT_PREFIX}{ip}")
