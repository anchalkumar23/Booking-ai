# Phase 1 — Scaffold + DB Schema + Auth + Sign-In Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the complete Booking AI monorepo with all Docker services, 10-table PostgreSQL schema, JWT auth, and a polished split-panel sign-in page — deployable to Hostinger VPS with one command.

**Architecture:** Monorepo with `backend/` (FastAPI + SQLAlchemy + Alembic + Celery) and `frontend/` (Next.js App Router), orchestrated by Docker Compose. Nginx reverse-proxies `/api/*` to FastAPI and `/*` to Next.js. Auth uses httpOnly JWT cookies; a single admin account is seeded from `.env` on first startup.

**Tech Stack:** Python 3.12, FastAPI 0.115, SQLAlchemy 2.0, Alembic, PostgreSQL 16, Redis 7, Celery 5, python-jose, passlib[bcrypt], Next.js 15 (App Router), TypeScript, CSS Modules, Syne + Plus Jakarta Sans fonts, Docker Compose, Nginx.

---

## File Map

```
booking-ai/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 001_initial_schema.py
│   │       └── 002_seed_admin.py
│   ├── app/
│   │   ├── main.py                        # FastAPI app, lifespan, CORS
│   │   ├── core/
│   │   │   ├── config.py                  # Pydantic Settings (reads .env)
│   │   │   ├── database.py                # Engine, SessionLocal, get_db
│   │   │   └── security.py                # JWT, bcrypt, Redis lockout
│   │   ├── models/
│   │   │   ├── base.py                    # Declarative base + UUID mixin
│   │   │   ├── user.py
│   │   │   ├── location.py
│   │   │   ├── customer.py
│   │   │   ├── suppression.py
│   │   │   ├── appointment.py
│   │   │   ├── membership.py
│   │   │   ├── lead.py
│   │   │   ├── call_log.py
│   │   │   ├── whatsapp_message.py
│   │   │   └── lead_sequence_step.py
│   │   ├── schemas/
│   │   │   └── auth.py                    # LoginRequest, TokenResponse
│   │   ├── services/
│   │   │   └── auth.py                    # authenticate_user, issue_tokens
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py              # Combines all v1 routes
│   │   │       └── auth.py                # /login, /refresh, /logout, /me
│   │   ├── tasks/
│   │   │   └── celery_app.py              # Celery instance (stub)
│   │   └── integrations/
│   │       ├── bolna.py                   # Stub
│   │       ├── whatsapp.py                # Stub
│   │       └── google_calendar.py         # Stub
│   └── tests/
│       ├── conftest.py                    # App client, DB override, Redis mock
│       └── test_auth.py                   # Login, refresh, lockout, logout
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── middleware.ts                       # Protects /dashboard/*
    ├── app/
    │   ├── layout.tsx                     # Root layout, font import
    │   ├── (auth)/
    │   │   └── login/
    │   │       ├── page.tsx               # Sign-in page component
    │   │       └── login.module.css       # All styles
    │   └── dashboard/
    │       └── page.tsx                   # Protected placeholder
    ├── components/
    │   └── Toast.tsx                      # Error/success toast
    └── lib/
        ├── api.ts                         # Typed fetch wrapper (base URL, error shape)
        └── auth.ts                        # login(), logout(), refreshToken() calls
```

---

## Task 1: Root scaffold — git, .gitignore, .env.example

**Files:**
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
dist/
build/
.pytest_cache/
.mypy_cache/
htmlcov/

# Environment
.env
*.env.local

# Node
node_modules/
.next/
frontend/.next/
frontend/out/

# Docker
*.log

# Editor
.vscode/
.idea/
*.swp

# Superpowers (brainstorm mockups — not source code)
.superpowers/

# Alembic
backend/alembic/versions/__pycache__/
```

- [ ] **Step 2: Create `.env.example`**

```env
# Database
POSTGRES_DB=bookingai
POSTGRES_USER=bookingai
POSTGRES_PASSWORD=changeme
DATABASE_URL=postgresql://bookingai:changeme@postgres:5432/bookingai

# Redis
REDIS_URL=redis://redis:6379/0

# Auth
SECRET_KEY=changeme-generate-with-openssl-rand-hex-32
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Admin seed (used once on first startup if users table is empty)
ADMIN_EMAIL=admin@bookingai.com
ADMIN_PASSWORD=changeme
ADMIN_NAME=Admin

# Integrations (leave blank until Phase 2+)
BOLNA_API_KEY=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
GOOGLE_CALENDAR_CREDENTIALS_JSON=

# Optional
SENTRY_DSN=
```

- [ ] **Step 3: Copy `.env.example` to `.env` and fill in real values**

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, SECRET_KEY (run: openssl rand -hex 32), ADMIN_PASSWORD
```

- [ ] **Step 4: Commit**

```bash
git init
git add .gitignore .env.example
git commit -m "chore: root scaffold — gitignore and env template"
```

---

## Task 2: Docker Compose + Nginx

**Files:**
- Create: `docker-compose.yml`
- Create: `nginx/nginx.conf`

- [ ] **Step 1: Create `nginx/nginx.conf`**

```nginx
upstream fastapi {
    server fastapi:8000;
}

upstream nextjs {
    server nextjs:3000;
}

server {
    listen 80;
    server_name _;
    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://fastapi;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://nextjs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - fastapi
      - nextjs
    restart: unless-stopped

  fastapi:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  nextjs:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    env_file: .env
    environment:
      - NEXT_PUBLIC_API_URL=http://nginx/api
      - INTERNAL_API_URL=http://fastapi:8000/api
    restart: unless-stopped

  celery:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app worker --loglevel=info
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  celery-beat:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app beat --loglevel=info
    env_file: .env
    depends_on:
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

volumes:
  postgres_data:
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml nginx/
git commit -m "chore: docker compose and nginx reverse proxy"
```

---

## Task 3: Backend scaffold — requirements, Dockerfile, app skeleton

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/Dockerfile`
- Create: `backend/app/__init__.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/v1/__init__.py`
- Create: `backend/app/tasks/__init__.py`
- Create: `backend/app/integrations/__init__.py`

- [ ] **Step 1: Create `backend/requirements.txt`**

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.36
alembic==1.13.3
psycopg2-binary==2.9.9
redis==5.1.1
celery==5.4.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.12
pydantic-settings==2.5.2
httpx==0.27.2
pytest==8.3.3
pytest-asyncio==0.24.0
```

- [ ] **Step 2: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

- [ ] **Step 3: Create all `__init__.py` files**

Each of these is an empty file:
- `backend/app/__init__.py`
- `backend/app/core/__init__.py`
- `backend/app/models/__init__.py`
- `backend/app/schemas/__init__.py`
- `backend/app/services/__init__.py`
- `backend/app/api/__init__.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/tasks/__init__.py`
- `backend/app/integrations/__init__.py`
- `backend/tests/__init__.py`

```bash
mkdir -p backend/app/core backend/app/models backend/app/schemas \
         backend/app/services backend/app/api/v1 backend/app/tasks \
         backend/app/integrations backend/tests
touch backend/app/__init__.py backend/app/core/__init__.py \
      backend/app/models/__init__.py backend/app/schemas/__init__.py \
      backend/app/services/__init__.py backend/app/api/__init__.py \
      backend/app/api/v1/__init__.py backend/app/tasks/__init__.py \
      backend/app/integrations/__init__.py backend/tests/__init__.py
```

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "chore: backend scaffold — requirements, dockerfile, package structure"
```

---

## Task 4: Core config + database

**Files:**
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/database.py`

- [ ] **Step 1: Create `backend/app/core/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    redis_url: str

    secret_key: str
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    admin_email: str
    admin_password: str
    admin_name: str = "Admin"

    sentry_dsn: str = ""


settings = Settings()
```

- [ ] **Step 2: Create `backend/app/core/database.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from app.core.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/
git commit -m "feat: core config (pydantic settings) and database session"
```

---

## Task 5: Security module — JWT, bcrypt, Redis lockout

**Files:**
- Create: `backend/app/core/security.py`

- [ ] **Step 1: Create `backend/app/core/security.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/core/security.py
git commit -m "feat: security module — JWT, bcrypt, Redis lockout + refresh rotation"
```

---

## Task 6: SQLAlchemy models — base + all 10 tables

**Files:**
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/location.py`
- Create: `backend/app/models/customer.py`
- Create: `backend/app/models/suppression.py`
- Create: `backend/app/models/appointment.py`
- Create: `backend/app/models/membership.py`
- Create: `backend/app/models/lead.py`
- Create: `backend/app/models/call_log.py`
- Create: `backend/app/models/whatsapp_message.py`
- Create: `backend/app/models/lead_sequence_step.py`

- [ ] **Step 1: Create `backend/app/models/base.py`**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID


class Base(DeclarativeBase):
    pass


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
```

- [ ] **Step 2: Create `backend/app/models/user.py`**

```python
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin


class User(UUIDMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

- [ ] **Step 3: Create `backend/app/models/location.py`**

```python
import enum
from sqlalchemy import String, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin


class LocationType(str, enum.Enum):
    gym = "gym"
    salon = "salon"
    restaurant = "restaurant"


class Location(UUIDMixin, Base):
    __tablename__ = "locations"

    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[LocationType] = mapped_column(SAEnum(LocationType), nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    timezone: Mapped[str] = mapped_column(String, default="Asia/Kolkata")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

- [ ] **Step 4: Create `backend/app/models/customer.py`**

```python
import enum
import uuid
from sqlalchemy import String, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin


class Language(str, enum.Enum):
    en = "en"
    hi = "hi"
    ta = "ta"


class Customer(UUIDMixin, Base):
    __tablename__ = "customers"

    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    language: Mapped[Language] = mapped_column(SAEnum(Language), default=Language.en)
    is_dnd: Mapped[bool] = mapped_column(Boolean, default=False)
    is_suppressed: Mapped[bool] = mapped_column(Boolean, default=False)

    location = relationship("Location", lazy="select")
```

- [ ] **Step 5: Create `backend/app/models/suppression.py`**

```python
import enum
from sqlalchemy import String, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin
import uuid
from datetime import datetime, timezone


class SuppressionReason(str, enum.Enum):
    opt_out = "opt_out"
    not_interested = "not_interested"
    dnd = "dnd"
    manual = "manual"


class SuppressionSource(str, enum.Enum):
    call = "call"
    whatsapp = "whatsapp"
    dashboard = "dashboard"


class SuppressionList(UUIDMixin, Base):
    __tablename__ = "suppression_list"

    phone: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    reason: Mapped[SuppressionReason] = mapped_column(SAEnum(SuppressionReason), nullable=False)
    source: Mapped[SuppressionSource] = mapped_column(SAEnum(SuppressionSource), nullable=False)
    suppressed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
```

- [ ] **Step 6: Create `backend/app/models/appointment.py`**

```python
import enum
import uuid
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin
from datetime import datetime


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class BookedVia(str, enum.Enum):
    call = "call"
    whatsapp = "whatsapp"
    dashboard = "dashboard"


class Appointment(UUIDMixin, Base):
    __tablename__ = "appointments"
    __table_args__ = (
        UniqueConstraint("location_id", "scheduled_at", name="uq_location_slot"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    service: Mapped[str] = mapped_column(String, nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_mins: Mapped[int] = mapped_column(Integer, default=60)
    status: Mapped[AppointmentStatus] = mapped_column(SAEnum(AppointmentStatus), default=AppointmentStatus.scheduled)
    gcal_event_id: Mapped[str | None] = mapped_column(String, nullable=True)
    booked_via: Mapped[BookedVia] = mapped_column(SAEnum(BookedVia), nullable=False)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
```

- [ ] **Step 7: Create `backend/app/models/membership.py`**

```python
import enum
import uuid
from sqlalchemy import String, Boolean, Date, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin
from datetime import date


class PaymentStatus(str, enum.Enum):
    paid = "paid"
    pending = "pending"
    overdue = "overdue"


class Membership(UUIDMixin, Base):
    __tablename__ = "memberships"

    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    tier: Mapped[str] = mapped_column(String, nullable=False)
    starts_at: Mapped[date] = mapped_column(Date, nullable=False)
    expires_at: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    payment_status: Mapped[PaymentStatus] = mapped_column(SAEnum(PaymentStatus), default=PaymentStatus.pending)
    renewal_call_sent: Mapped[bool] = mapped_column(Boolean, default=False)
```

- [ ] **Step 8: Create `backend/app/models/lead.py`**

```python
import enum
import uuid
from sqlalchemy import String, Boolean, Integer, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin
from app.models.customer import Language


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    interested = "interested"
    converted = "converted"
    not_interested = "not_interested"


class Lead(UUIDMixin, Base):
    __tablename__ = "leads"

    location_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    language: Mapped[Language] = mapped_column(SAEnum(Language), default=Language.en)
    source: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[LeadStatus] = mapped_column(SAEnum(LeadStatus), default=LeadStatus.new)
    wa_sequence_step: Mapped[int] = mapped_column(Integer, default=0)
    wa_stopped: Mapped[bool] = mapped_column(Boolean, default=False)
    call_stopped: Mapped[bool] = mapped_column(Boolean, default=False)
```

- [ ] **Step 9: Create `backend/app/models/call_log.py`**

```python
import enum
from sqlalchemy import String, Float, Integer, Text, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin
from datetime import datetime, timezone


class CallDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class CallPurpose(str, enum.Enum):
    booking = "booking"
    reminder = "reminder"
    renewal = "renewal"
    lead = "lead"
    inbound = "inbound"


class CallOutcome(str, enum.Enum):
    booked = "booked"
    rescheduled = "rescheduled"
    busy = "busy"
    not_interested = "not_interested"
    no_answer = "no_answer"
    transferred = "transferred"
    low_confidence = "low_confidence"
    failed = "failed"


class CallLog(UUIDMixin, Base):
    __tablename__ = "call_logs"

    bolna_call_id: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    direction: Mapped[CallDirection] = mapped_column(SAEnum(CallDirection), nullable=False)
    purpose: Mapped[CallPurpose] = mapped_column(SAEnum(CallPurpose), nullable=False)
    outcome: Mapped[CallOutcome | None] = mapped_column(SAEnum(CallOutcome), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_secs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    recording_url: Mapped[str | None] = mapped_column(String, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    called_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
```

- [ ] **Step 10: Create `backend/app/models/whatsapp_message.py`**

```python
import enum
from sqlalchemy import String, Text, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin
from datetime import datetime, timezone


class WADirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class WAMessageType(str, enum.Enum):
    template = "template"
    session = "session"


class WAStatus(str, enum.Enum):
    sent = "sent"
    delivered = "delivered"
    read = "read"
    failed = "failed"
    replied = "replied"


class WhatsAppMessage(UUIDMixin, Base):
    __tablename__ = "whatsapp_messages"

    wa_message_id: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    direction: Mapped[WADirection] = mapped_column(SAEnum(WADirection), nullable=False)
    message_type: Mapped[WAMessageType] = mapped_column(SAEnum(WAMessageType), nullable=False)
    template_name: Mapped[str | None] = mapped_column(String, nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[WAStatus] = mapped_column(SAEnum(WAStatus), default=WAStatus.sent)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
```

- [ ] **Step 11: Create `backend/app/models/lead_sequence_step.py`**

```python
import enum
import uuid
from sqlalchemy import Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin
from datetime import datetime


class StepChannel(str, enum.Enum):
    whatsapp = "whatsapp"
    call = "call"


class StepStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    delivered = "delivered"
    replied = "replied"
    failed = "failed"


class LeadSequenceStep(UUIDMixin, Base):
    __tablename__ = "lead_sequence_steps"

    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[StepChannel] = mapped_column(SAEnum(StepChannel), nullable=False)
    status: Mapped[StepStatus] = mapped_column(SAEnum(StepStatus), default=StepStatus.pending)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    lead = relationship("Lead", lazy="select")
```

- [ ] **Step 12: Commit**

```bash
git add backend/app/models/
git commit -m "feat: all 10 SQLAlchemy models — users, locations, customers, suppression, appointments, memberships, leads, call_logs, whatsapp_messages, lead_sequence_steps"
```

---

## Task 7: Alembic setup + initial migration

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/001_initial_schema.py`

- [ ] **Step 1: Initialize Alembic inside backend/**

```bash
cd backend
python -m alembic init alembic
```

This creates `alembic.ini` and `alembic/` directory.

- [ ] **Step 2: Replace `backend/alembic/env.py` with this content**

```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.models.base import Base
# Import all models so Alembic can detect them
import app.models.user
import app.models.location
import app.models.customer
import app.models.suppression
import app.models.appointment
import app.models.membership
import app.models.lead
import app.models.call_log
import app.models.whatsapp_message
import app.models.lead_sequence_step

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Generate migration for all 10 tables**

```bash
cd backend
alembic revision --autogenerate -m "initial_schema"
```

This creates `backend/alembic/versions/<hash>_initial_schema.py`. Verify it contains `CREATE TABLE` statements for all 10 tables.

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/ backend/alembic.ini
git commit -m "feat: alembic setup + initial schema migration for all 10 tables"
```

---

## Task 8: Admin seed migration

**Files:**
- Create: `backend/alembic/versions/002_seed_admin.py`

- [ ] **Step 1: Create `backend/alembic/versions/002_seed_admin.py`**

```python
"""seed admin user

Revision ID: 002
Revises: 001
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text
import uuid
import os
from passlib.context import CryptContext

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
    if result == 0:
        admin_email = os.environ["ADMIN_EMAIL"]
        admin_password = os.environ["ADMIN_PASSWORD"]
        admin_name = os.environ.get("ADMIN_NAME", "Admin")
        conn.execute(
            text(
                "INSERT INTO users (id, email, hashed_password, full_name, is_active, created_at) "
                "VALUES (:id, :email, :password, :name, true, NOW())"
            ),
            {
                "id": str(uuid.uuid4()),
                "email": admin_email,
                "password": pwd_context.hash(admin_password),
                "name": admin_name,
            },
        )


def downgrade() -> None:
    pass
```

- [ ] **Step 2: Update the `down_revision` in `002_seed_admin.py`**

Replace `down_revision = "001"` with the actual revision ID generated in Task 7 Step 3 (the hex string before `_initial_schema.py`).

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/002_seed_admin.py
git commit -m "feat: seed admin user migration from env vars"
```

---

## Task 9: Auth schemas + service

**Files:**
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/services/auth.py`

- [ ] **Step 1: Create `backend/app/schemas/auth.py`**

```python
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class MeResponse(BaseModel):
    id: str
    email: str
    full_name: str
```

- [ ] **Step 2: Create `backend/app/services/auth.py`**

```python
from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import verify_password


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/ backend/app/services/
git commit -m "feat: auth schemas (LoginRequest, MeResponse) and authenticate_user service"
```

---

## Task 10: Auth API endpoints

**Files:**
- Create: `backend/app/api/v1/auth.py`
- Create: `backend/app/api/v1/router.py`

- [ ] **Step 1: Create `backend/app/api/v1/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from jose import JWTError
from app.core.database import get_db
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
)
from app.schemas.auth import LoginRequest, MeResponse
from app.services.auth import authenticate_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
COOKIE_OPTS = dict(httponly=True, samesite="lax", secure=False)  # set secure=True in prod


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
    return {"message": "Logged out"}


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(_get_current_user)):
    return MeResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
    )
```

- [ ] **Step 2: Create `backend/app/api/v1/router.py`**

```python
from fastapi import APIRouter
from app.api.v1 import auth

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/
git commit -m "feat: auth API — /login, /refresh, /logout, /me with lockout and cookie rotation"
```

---

## Task 11: FastAPI main.py + integration stubs

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/tasks/celery_app.py`
- Create: `backend/app/integrations/bolna.py`
- Create: `backend/app/integrations/whatsapp.py`
- Create: `backend/app/integrations/google_calendar.py`

- [ ] **Step 1: Create `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import router

app = FastAPI(title="Booking AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 2: Create `backend/app/tasks/celery_app.py`**

```python
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "booking_ai",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_max_retries=3,
)
```

- [ ] **Step 3: Create integration stubs**

`backend/app/integrations/bolna.py`:
```python
# Phase 3: Bolna AI voice call integration
# Placeholder — implement in Phase 3
```

`backend/app/integrations/whatsapp.py`:
```python
# Phase 4: Meta WhatsApp Business Cloud API integration
# Placeholder — implement in Phase 4
```

`backend/app/integrations/google_calendar.py`:
```python
# Phase 2: Google Calendar sync
# Placeholder — implement in Phase 2
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py backend/app/tasks/ backend/app/integrations/
git commit -m "feat: FastAPI app entry point, Celery stub, integration placeholders"
```

---

## Task 12: Backend tests

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Create `backend/tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import get_db
from app.models.base import Base
from app.models.user import User
from app.core.security import hash_password

SQLITE_URL = "sqlite:///:memory:"

engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db):
    user = User(
        email="admin@test.com",
        hashed_password=hash_password("correctpassword"),
        full_name="Test Admin",
    )
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def mock_redis():
    with patch("app.core.security.get_redis") as mock:
        r = MagicMock()
        r.get.return_value = None
        r.incr.return_value = 1
        r.setex.return_value = True
        r.delete.return_value = True
        r.expire.return_value = True
        mock.return_value = r
        yield r
```

- [ ] **Step 2: Create `backend/tests/test_auth.py`**

```python
import pytest


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_login_success(client, admin_user, mock_redis):
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "correctpassword"})
    assert r.status_code == 200
    assert r.json()["message"] == "Logged in successfully"
    assert "access_token" in r.cookies
    assert "refresh_token" in r.cookies


def test_login_wrong_password(client, admin_user, mock_redis):
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "wrongpassword"})
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "invalid_credentials"


def test_login_wrong_email(client, admin_user, mock_redis):
    r = client.post("/api/v1/auth/login", json={"email": "nobody@test.com", "password": "correctpassword"})
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "invalid_credentials"


def test_login_lockout(client, admin_user, mock_redis):
    mock_redis.get.return_value = "5"  # already at limit
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "wrong"})
    assert r.status_code == 429
    assert r.json()["detail"]["code"] == "locked_out"


def test_me_authenticated(client, admin_user, mock_redis):
    client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "correctpassword"})
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "admin@test.com"


def test_me_unauthenticated(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_logout(client, admin_user, mock_redis):
    client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "correctpassword"})
    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 200
    assert "access_token" not in r.cookies or r.cookies.get("access_token") == ""


def test_refresh(client, admin_user, mock_redis):
    client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "correctpassword"})
    old_refresh = client.cookies.get("refresh_token")
    mock_redis.get.return_value = "admin@test.com"
    r = client.post("/api/v1/auth/refresh")
    assert r.status_code == 200
    assert "access_token" in r.cookies
```

- [ ] **Step 3: Run the tests to confirm they pass**

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

Expected output: all 9 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/
git commit -m "test: auth endpoint tests — login, lockout, refresh, logout, /me"
```

---

## Task 13: Frontend scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd frontend
npx create-next-app@latest . --typescript --app --no-tailwind --no-src-dir --import-alias "@/*"
```

Accept all defaults. This creates `package.json`, `tsconfig.json`, `next.config.ts`, and the `app/` directory.

- [ ] **Step 2: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Enable standalone output in `frontend/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "chore: Next.js 15 App Router scaffold with standalone Docker output"
```

---

## Task 14: Frontend lib — API client + auth helpers

**Files:**
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/auth.ts`

- [ ] **Step 1: Create `frontend/lib/api.ts`**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export interface ApiError {
  message: string;
  code: string;
}

export class HttpError extends Error {
  constructor(public status: number, public detail: ApiError) {
    super(detail.message);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: { message: "Unknown error", code: "unknown" } }));
    const detail: ApiError =
      typeof body.detail === "object"
        ? body.detail
        : { message: body.detail ?? "Request failed", code: "error" };
    throw new HttpError(res.status, detail);
  }

  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Create `frontend/lib/auth.ts`**

```typescript
import { apiFetch, HttpError } from "./api";

export interface MeResponse {
  id: string;
  email: string;
  full_name: string;
}

export async function login(email: string, password: string): Promise<void> {
  await apiFetch("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/v1/auth/logout", { method: "POST" });
}

export async function refreshToken(): Promise<boolean> {
  try {
    await apiFetch("/v1/auth/refresh", { method: "POST" });
    return true;
  } catch {
    return false;
  }
}

export async function getMe(): Promise<MeResponse | null> {
  try {
    return await apiFetch<MeResponse>("/v1/auth/me");
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/
git commit -m "feat: frontend API client and auth helpers (login, logout, refresh, getMe)"
```

---

## Task 15: Toast component

**Files:**
- Create: `frontend/components/Toast.tsx`

- [ ] **Step 1: Create `frontend/components/Toast.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "error" | "success";
  onClose: () => void;
}

export function Toast({ message, type = "error", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: type === "error" ? "#fef2f2" : "#f0fdf4",
        border: `1.5px solid ${type === "error" ? "#fca5a5" : "#86efac"}`,
        color: type === "error" ? "#b91c1c" : "#15803d",
        borderRadius: "12px",
        padding: "12px 20px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: "13px",
        fontWeight: 500,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        maxWidth: "360px",
        whiteSpace: "nowrap",
      }}
    >
      <span>{type === "error" ? "⚠" : "✓"}</span>
      {message}
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          marginLeft: "8px",
          color: "inherit",
          opacity: 0.6,
          fontSize: "16px",
          lineHeight: 1,
          padding: 0,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/
git commit -m "feat: Toast component for error/success notifications"
```

---

## Task 16: Root layout + global font import

**Files:**
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Replace `frontend/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booking AI",
  description: "AI-Powered Business Automation Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `frontend/app/globals.css` with minimal reset**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/layout.tsx frontend/app/globals.css
git commit -m "feat: root layout with Syne + Plus Jakarta Sans font import"
```

---

## Task 17: Sign-in page

**Files:**
- Create: `frontend/app/(auth)/login/page.tsx`
- Create: `frontend/app/(auth)/login/login.module.css`

- [ ] **Step 1: Create `frontend/app/(auth)/login/login.module.css`**

```css
.page {
  display: flex;
  min-height: 100vh;
  overflow: hidden;
  background: #0d0d14;
}

/* ── Left Panel ── */
.left {
  width: 52%;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 60px 56px;
  overflow: hidden;
  background: linear-gradient(140deg, #12003a 0%, #1a0050 40%, #0a1a3a 100%);
}

.grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.55;
  animation: drift 8s ease-in-out infinite;
}
.orb1 { width: 420px; height: 420px; background: #7c3aed; top: -120px; left: -80px; animation-delay: 0s; }
.orb2 { width: 320px; height: 320px; background: #ec4899; bottom: -60px; right: -60px; animation-delay: -3s; }
.orb3 { width: 250px; height: 250px; background: #0ea5e9; top: 45%; left: 30%; animation-delay: -5s; }

@keyframes drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%       { transform: translate(20px, -24px) scale(1.06); }
  66%       { transform: translate(-16px, 12px) scale(0.96); }
}

.leftContent {
  position: relative;
  z-index: 2;
}

.brandMark {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 64px;
}
.brandIcon {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f472b6, #a78bfa, #60a5fa);
  display: flex; align-items: center; justify-content: center;
  color: white;
  font-family: 'Syne', sans-serif;
  font-weight: 800; font-size: 20px;
  box-shadow: 0 0 28px rgba(167,139,250,0.5);
}
.brandName {
  font-family: 'Syne', sans-serif;
  font-weight: 700; font-size: 18px;
  color: white;
}
.brandTagline { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }

.headline {
  font-family: 'Syne', sans-serif;
  font-size: 48px; font-weight: 800;
  line-height: 1.1; color: white;
  margin-bottom: 20px;
  letter-spacing: -0.02em;
}
.headlineAccent {
  background: linear-gradient(90deg, #f472b6, #a78bfa, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subheadline {
  font-size: 15px;
  color: rgba(255,255,255,0.5);
  line-height: 1.7;
  max-width: 380px;
  margin-bottom: 48px;
}

.stats { display: flex; flex-direction: column; gap: 14px; }
.statRow {
  display: flex; align-items: center; gap: 14px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 14px 18px;
  backdrop-filter: blur(8px);
  transition: background 0.2s;
}
.statRow:hover { background: rgba(255,255,255,0.08); }
.statIcon {
  width: 38px; height: 38px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}
.iconPink   { background: rgba(244,114,182,0.18); }
.iconTeal   { background: rgba(20,184,166,0.18); }
.iconIndigo { background: rgba(139,92,246,0.18); }
.iconAmber  { background: rgba(245,158,11,0.18); }
.statInfo { flex: 1; }
.statTitle { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.9); }
.statSub   { font-size: 11px; color: rgba(255,255,255,0.38); margin-top: 2px; }
.statVal {
  font-family: 'Syne', sans-serif;
  font-size: 16px; font-weight: 700; color: white;
}

/* ── Right Panel ── */
.right {
  flex: 1;
  background: #fafbff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  position: relative;
}
.right::before {
  content: '';
  position: absolute;
  top: -100px; right: -100px;
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.right::after {
  content: '';
  position: absolute;
  bottom: -80px; left: -80px;
  width: 320px; height: 320px;
  background: radial-gradient(circle, rgba(244,114,182,0.07) 0%, transparent 70%);
  pointer-events: none;
}

.formWrap { width: 100%; max-width: 400px; position: relative; z-index: 2; }

.formHeader { margin-bottom: 36px; }
.formTitle {
  font-family: 'Syne', sans-serif;
  font-size: 30px; font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}
.formSubtitle { font-size: 14px; color: #94a3b8; line-height: 1.5; }

.field { margin-bottom: 20px; }
.fieldLabel {
  display: block;
  font-size: 12px; font-weight: 600;
  color: #475569; margin-bottom: 8px;
  letter-spacing: 0.02em;
}
.fieldInner { position: relative; }
.fieldIcon {
  position: absolute;
  left: 14px; top: 50%;
  transform: translateY(-50%);
  color: #c4cdd8; font-size: 15px;
  pointer-events: none;
}
.fieldInput {
  width: 100%;
  padding: 13px 14px 13px 40px;
  border: 1.5px solid #e8edf5;
  border-radius: 12px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px; color: #0f172a;
  background: white; outline: none;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.fieldInput:focus {
  border-color: #a78bfa;
  box-shadow: 0 0 0 4px rgba(167,139,250,0.1), 0 1px 3px rgba(0,0,0,0.04);
}
.fieldInput::placeholder { color: #c4cdd8; }

.rowBetween {
  display: flex; align-items: center;
  justify-content: space-between;
  margin-bottom: 28px; margin-top: -4px;
}
.remember {
  display: flex; align-items: center; gap: 7px;
  font-size: 13px; color: #64748b; cursor: pointer;
}
.remember input[type="checkbox"] { accent-color: #a78bfa; width: 15px; height: 15px; cursor: pointer; }
.forgot { font-size: 13px; color: #a78bfa; text-decoration: none; font-weight: 500; }
.forgot:hover { text-decoration: underline; }

.btn {
  width: 100%;
  padding: 15px;
  border: none; border-radius: 12px;
  background: linear-gradient(90deg, #f472b6 0%, #a78bfa 55%, #60a5fa 100%);
  color: white;
  font-family: 'Syne', sans-serif;
  font-size: 15px; font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 4px 24px rgba(167,139,250,0.35);
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(167,139,250,0.45);
  opacity: 0.95;
}
.btn:active:not(:disabled) { transform: translateY(0); }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }

.divider {
  display: flex; align-items: center; gap: 12px;
  margin: 24px 0; color: #d1d9e0; font-size: 12px;
}
.divider::before, .divider::after {
  content: ''; flex: 1; height: 1px; background: #edf1f7;
}

.statusBadge {
  display: flex; align-items: center; gap: 7px;
  background: #f0fdf9;
  border: 1px solid #bbf7e6;
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 12px; color: #059669; font-weight: 500;
  width: fit-content; margin: 0 auto;
}
.dotLive {
  width: 7px; height: 7px; border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 0 3px rgba(52,211,153,0.25);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(52,211,153,0.25); }
  50%       { box-shadow: 0 0 0 6px rgba(52,211,153,0.1); }
}

.footerNote {
  margin-top: 32px;
  text-align: center;
  font-size: 11.5px;
  color: #c4cdd8;
}

@media (max-width: 768px) {
  .left { display: none; }
  .right { flex: 1; }
}
```

- [ ] **Step 2: Create `frontend/app/(auth)/login/page.tsx`**

```tsx
"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/auth";
import { HttpError } from "@/lib/api";
import { Toast } from "@/components/Toast";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    if (searchParams.get("session") === "expired") {
      setToast({ message: "Your session expired. Please sign in again.", type: "error" });
    }
  }, [searchParams]);

  const dismissToast = useCallback(() => setToast(null), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof HttpError) {
        setToast({ message: err.detail.message, type: "error" });
      } else {
        setToast({ message: "Service temporarily unavailable. Try again shortly.", type: "error" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}

      {/* Left brand panel */}
      <div className={styles.left}>
        <div className={styles.grid} />
        <div className={`${styles.orb} ${styles.orb1}`} />
        <div className={`${styles.orb} ${styles.orb2}`} />
        <div className={`${styles.orb} ${styles.orb3}`} />

        <div className={styles.leftContent}>
          <div className={styles.brandMark}>
            <div className={styles.brandIcon}>B</div>
            <div>
              <div className={styles.brandName}>Booking AI</div>
              <div className={styles.brandTagline}>Automation Platform</div>
            </div>
          </div>

          <h1 className={styles.headline}>
            Automate.<br />
            <span className={styles.headlineAccent}>Engage.</span><br />
            Grow.
          </h1>
          <p className={styles.subheadline}>
            AI-powered voice calls and WhatsApp automation for your gyms, salons &amp; restaurants — all from one dashboard.
          </p>

          <div className={styles.stats}>
            {[
              { icon: "📞", label: "AI Voice Calls", sub: "Inbound & outbound · 3 languages", val: "24/7", cls: styles.iconPink },
              { icon: "💬", label: "WhatsApp Sequences", sub: "4-step automated outreach", val: "Auto", cls: styles.iconTeal },
              { icon: "📅", label: "Smart Booking", sub: "Real-time slot availability", val: "Live", cls: styles.iconIndigo },
              { icon: "📊", label: "Funnel Analytics", sub: "Leads → Booked → Paid", val: "Full", cls: styles.iconAmber },
            ].map(({ icon, label, sub, val, cls }) => (
              <div key={label} className={styles.statRow}>
                <div className={`${styles.statIcon} ${cls}`}>{icon}</div>
                <div className={styles.statInfo}>
                  <div className={styles.statTitle}>{label}</div>
                  <div className={styles.statSub}>{sub}</div>
                </div>
                <div className={styles.statVal}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.right}>
        <div className={styles.formWrap}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Welcome back</h2>
            <p className={styles.formSubtitle}>Sign in to your admin dashboard to manage your automation platform.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="email">EMAIL ADDRESS</label>
              <div className={styles.fieldInner}>
                <span className={styles.fieldIcon}>✉</span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@bookingai.com"
                  className={styles.fieldInput}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="password">PASSWORD</label>
              <div className={styles.fieldInner}>
                <span className={styles.fieldIcon}>🔒</span>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={styles.fieldInput}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.rowBetween}>
              <label className={styles.remember}>
                <input type="checkbox" /> Keep me signed in
              </label>
              <a href="#" className={styles.forgot}>Forgot password?</a>
            </div>

            <button type="submit" disabled={loading} className={styles.btn}>
              {loading ? "Signing in…" : "Sign In to Dashboard →"}
            </button>
          </form>

          <div className={styles.divider}>or</div>

          <div className={styles.statusBadge}>
            <span className={styles.dotLive} />
            All systems operational
          </div>

          <p className={styles.footerNote}>
            Secured with 256-bit encryption &nbsp;·&nbsp; Booking AI © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/\(auth\)/
git commit -m "feat: sign-in page — split panel dark/light with animated orbs and JWT form"
```

---

## Task 18: Dashboard placeholder + Next.js middleware

**Files:**
- Create: `frontend/app/dashboard/page.tsx`
- Create: `frontend/middleware.ts`

- [ ] **Step 1: Create `frontend/app/dashboard/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", fontFamily: "'Syne', sans-serif",
      background: "#fafbff", flexDirection: "column", gap: "12px"
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "linear-gradient(135deg, #f472b6, #a78bfa, #60a5fa)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontWeight: 800, fontSize: 22
      }}>B</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Booking AI Dashboard</h1>
      <p style={{ color: "#94a3b8", fontSize: 14 }}>Phase 2 coming soon — appointment management, calls, and analytics.</p>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/middleware.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard"];
const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (accessToken) return NextResponse.next();

  if (refreshToken) {
    try {
      const apiBase = process.env.INTERNAL_API_URL ?? "http://fastapi:8000/api";
      const res = await fetch(`${apiBase}/v1/auth/refresh`, {
        method: "POST",
        headers: { Cookie: `${REFRESH_COOKIE}=${refreshToken}` },
      });
      if (res.ok) {
        const response = NextResponse.next();
        const setCookieHeader = res.headers.get("set-cookie");
        if (setCookieHeader) response.headers.set("set-cookie", setCookieHeader);
        return response;
      }
    } catch {
      // fall through to redirect
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("session", "expired");
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/ frontend/middleware.ts
git commit -m "feat: dashboard placeholder and Next.js route protection middleware"
```

---

## Task 19: End-to-end smoke test

- [ ] **Step 1: Start all services**

```bash
docker compose up --build -d
```

Wait ~30 seconds for postgres healthcheck and migrations to complete.

- [ ] **Step 2: Verify migration ran**

```bash
docker compose exec fastapi alembic current
```

Expected: shows revision `002` as current head.

- [ ] **Step 3: Verify health endpoint**

```bash
curl http://localhost/api/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Verify admin seeded**

```bash
docker compose exec postgres psql -U bookingai -d bookingai -c "SELECT email, full_name FROM users;"
```

Expected: one row with the email from your `.env`.

- [ ] **Step 5: Run backend tests in container**

```bash
docker compose exec fastapi pytest tests/ -v
```

Expected: all 9 tests PASS.

- [ ] **Step 6: Open browser and run manual smoke tests**

Open `http://localhost` and verify:

- [ ] Sign-in page loads (split panel — dark left, white right)
- [ ] Logging in with wrong password shows "Invalid email or password" toast
- [ ] Logging in with correct credentials redirects to `/dashboard`
- [ ] Refreshing `/dashboard` keeps you logged in
- [ ] Navigating directly to `/dashboard` while logged out redirects to `/login?session=expired`
- [ ] Logging in from the expired link shows "Your session expired" toast

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: Phase 1 complete — scaffold, schema, auth, sign-in page all verified"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Monorepo structure with exact paths from spec
- ✅ 7 Docker services (nginx, fastapi, nextjs, celery, celery-beat, postgres, redis)
- ✅ All 10 database tables with correct columns, types, and constraints
- ✅ UUID PKs throughout
- ✅ Double-booking unique constraint on `(location_id, scheduled_at)`
- ✅ `bolna_call_id` and `wa_message_id` unique for webhook idempotency
- ✅ JWT access (30m) + refresh (7d) tokens as httpOnly cookies
- ✅ bcrypt cost factor 12 via passlib
- ✅ Redis-based lockout (5 attempts → 15-min block) + refresh token rotation
- ✅ Admin seeded from `.env` if users table is empty
- ✅ No registration endpoint exists anywhere
- ✅ Generic error message — never reveals which credential is wrong
- ✅ Session expired redirect to `/login?session=expired` with toast
- ✅ Silent token refresh in Next.js middleware
- ✅ Sign-in page matches approved mockup (split panel, Syne font, orbs, stat rows)
- ✅ Integration stubs for Bolna, WhatsApp, Google Calendar
- ✅ Celery stub configured with correct Redis broker
- ✅ `.env.example` with all keys from spec
- ✅ `alembic upgrade head` runs before uvicorn in Dockerfile CMD
- ✅ All 9 backend tests cover: health, login success, wrong password, wrong email, lockout, /me authenticated, /me unauthenticated, logout, refresh
