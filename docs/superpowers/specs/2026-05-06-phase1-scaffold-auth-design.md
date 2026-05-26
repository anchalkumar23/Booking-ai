# Phase 1 Design Spec — Project Scaffold + DB Schema + Auth + Sign-In Page

**Project:** Booking AI — AI-Powered Business Automation Platform  
**Client:** Single multi-location gym/salon/restaurant operator, South India  
**Date:** 2026-05-06  
**Phase:** 1 of 6

---

## Overview

Phase 1 establishes the complete technical foundation for the Booking AI platform. It delivers:
- A production-ready monorepo with all Docker services wired together
- The full database schema (all 10 tables) so later phases have a stable foundation
- JWT-based authentication for a single admin account
- A polished sign-in page (the only frontend in this phase)

No automation logic, no Bolna AI, no WhatsApp — those are Phase 2+. This phase is purely about getting the skeleton right.

---

## Architecture

### Repository Layout

```
booking-ai/
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers (versioned under /api/v1/)
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic layer
│   │   ├── tasks/          # Celery task definitions (stubs in Phase 1)
│   │   ├── integrations/   # Bolna, WhatsApp, Google Calendar (stubs in Phase 1)
│   │   └── core/
│   │       ├── config.py   # Pydantic Settings from .env
│   │       ├── database.py # SQLAlchemy engine + session
│   │       └── security.py # JWT encode/decode, bcrypt hashing
│   ├── alembic/            # Database migrations
│   ├── tests/              # pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx    # Sign-in page
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Protected placeholder (Phase 2+)
│   │   └── layout.tsx
│   ├── components/
│   ├── lib/
│   │   ├── api.ts          # Typed fetch wrapper
│   │   └── auth.ts         # Token helpers
│   ├── middleware.ts        # Route protection
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   └── nginx.conf          # Reverse proxy: /api/* → FastAPI, /* → Next.js
├── docker-compose.yml
├── .env.example
└── CLAUDE.md
```

### Docker Services

| Service | Image | Port | Purpose |
|---|---|---|---|
| nginx | nginx:alpine | 80, 443 | Reverse proxy + SSL termination |
| fastapi | custom | 8000 | REST API + webhook handlers |
| nextjs | custom | 3000 | Next.js App Router frontend |
| celery | custom | — | Background job worker |
| celery-beat | custom | — | Cron scheduler |
| postgres | postgres:16 | 5432 | Primary database (persisted volume) |
| redis | redis:7 | 6379 | Celery broker + result backend |

**Nginx routing:**
- `POST/GET /api/*` → FastAPI on port 8000
- `/*` → Next.js on port 3000

**Deploy command:** `git pull && docker compose up -d --build`  
**Target host:** Hostinger VPS

---

## Database Schema

All 10 tables created in Phase 1 via Alembic migrations. UUID primary keys throughout.

### `users`
Single admin account. No self-registration endpoint exists.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | VARCHAR UNIQUE | |
| hashed_password | VARCHAR | bcrypt |
| full_name | VARCHAR | |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMP | |

### `locations`
Each physical gym/salon/restaurant branch.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR | |
| type | ENUM(gym, salon, restaurant) | |
| city | VARCHAR | |
| phone | VARCHAR | |
| timezone | VARCHAR | e.g. Asia/Kolkata |
| is_active | BOOLEAN | |
| created_at | TIMESTAMP | |

### `customers`
Customer/member profiles. One customer can have memberships at multiple locations.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| location_id | UUID FK → locations | |
| full_name | VARCHAR | |
| phone | VARCHAR UNIQUE | used for all outbound |
| email | VARCHAR | optional |
| language | ENUM(en, hi, ta) | drives Bolna + WA language |
| is_dnd | BOOLEAN | DND registry flag |
| is_suppressed | BOOLEAN | denormalized from suppression_list |
| created_at | TIMESTAMP | |

### `suppression_list`
Global opt-out list. Checked before every outbound call and WhatsApp message.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| phone | VARCHAR UNIQUE | |
| reason | ENUM(opt_out, not_interested, dnd, manual) | |
| source | ENUM(call, whatsapp, dashboard) | audit trail |
| suppressed_at | TIMESTAMP | |

### `appointments`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| customer_id | UUID FK → customers | |
| location_id | UUID FK → locations | |
| service | VARCHAR | e.g. "Haircut", "Gym Session" |
| scheduled_at | TIMESTAMP | |
| duration_mins | INTEGER | |
| status | ENUM(scheduled, completed, cancelled, no_show) | |
| gcal_event_id | VARCHAR | Google Calendar sync |
| booked_via | ENUM(call, whatsapp, dashboard) | |
| reminder_sent | BOOLEAN | prevents duplicate reminders |
| created_at | TIMESTAMP | |

**Double-booking prevention:** unique constraint on `(location_id, scheduled_at)`.

### `memberships`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| customer_id | UUID FK → customers | |
| location_id | UUID FK → locations | |
| tier | VARCHAR | e.g. "Gold", "Monthly" |
| starts_at | DATE | |
| expires_at | DATE | indexed for daily expiry job |
| payment_status | ENUM(paid, pending, overdue) | |
| renewal_call_sent | BOOLEAN | prevents duplicate renewal calls |
| created_at | TIMESTAMP | |

### `leads`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| location_id | UUID FK → locations | |
| full_name | VARCHAR | |
| phone | VARCHAR | |
| language | ENUM(en, hi, ta) | |
| source | VARCHAR | e.g. "csv_import", "api" |
| status | ENUM(new, contacted, interested, converted, not_interested) | |
| wa_sequence_step | INTEGER | 0–4, current WhatsApp step |
| wa_stopped | BOOLEAN | stops WA if call converted |
| call_stopped | BOOLEAN | stops calls if WA converted |
| created_at | TIMESTAMP | |

### `call_logs`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| bolna_call_id | VARCHAR UNIQUE | webhook idempotency key |
| phone | VARCHAR | |
| direction | ENUM(inbound, outbound) | |
| purpose | ENUM(booking, reminder, renewal, lead, inbound) | |
| outcome | ENUM(booked, rescheduled, busy, not_interested, no_answer, transferred, low_confidence, failed) | |
| confidence_score | FLOAT | < 0.70 triggers human transfer |
| duration_secs | INTEGER | |
| transcript | TEXT | |
| recording_url | VARCHAR | |
| retry_count | INTEGER | default 0 |
| called_at | TIMESTAMP | |

### `whatsapp_messages`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| wa_message_id | VARCHAR UNIQUE | webhook idempotency key |
| phone | VARCHAR | |
| direction | ENUM(inbound, outbound) | |
| message_type | ENUM(template, session) | |
| template_name | VARCHAR | nullable for session messages |
| body | TEXT | |
| status | ENUM(sent, delivered, read, failed, replied) | |
| sent_at | TIMESTAMP | |

### `lead_sequence_steps`
Tracks each of the 4 WhatsApp/call outreach steps per lead.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| lead_id | UUID FK → leads | |
| step_number | INTEGER | 1–4 |
| channel | ENUM(whatsapp, call) | |
| status | ENUM(pending, sent, delivered, replied, failed) | |
| scheduled_at | TIMESTAMP | |
| sent_at | TIMESTAMP | nullable |

---

## Authentication

### Approach
Single admin account, no registration. Credentials seeded from `.env` on first startup.

### Flow
1. Admin POSTs `{email, password}` to `POST /api/v1/auth/login`
2. FastAPI verifies bcrypt hash → issues access token (30 min) + refresh token (7 days)
3. Both tokens set as `httpOnly; Secure; SameSite=Lax` cookies
4. Next.js middleware reads access token cookie on every request to `/dashboard/*`
5. If access token expired → middleware calls `POST /api/v1/auth/refresh` silently
6. If refresh token also expired → redirect to `/login?session=expired`
7. `POST /api/v1/auth/logout` clears both cookies

### Security details
- Passwords: bcrypt with cost factor 12
- Refresh token rotation: each use issues a new refresh token, old one invalidated (stored in Redis)
- No registration endpoint exists in any environment
- Rate limiting: 5 failed login attempts → 15-minute lockout per IP (tracked in Redis)

### Seed script
```
ADMIN_EMAIL=admin@bookingai.com
ADMIN_PASSWORD=<strong-password>
ADMIN_NAME=Admin
```
Alembic seed migration runs on `docker compose up` if `users` table is empty.

---

## Sign-In Page

**Design:** Split panel — dark left, light right.

**Left panel:**
- Deep indigo/purple animated background with 3 drifting blur orbs + grid overlay
- "Booking AI" brand mark (gradient B icon + Syne font wordmark)
- Headline: "Automate. Engage. Grow." with pink→purple→blue gradient on "Engage."
- 4 feature stat rows (glassmorphism cards): AI Voice Calls / WhatsApp Sequences / Smart Booking / Funnel Analytics

**Right panel:**
- Clean white background with subtle purple/pink corner glows
- Email + password fields with icon prefix
- "Keep me signed in" checkbox + "Forgot password?" link
- Pink→purple→blue gradient "Sign In to Dashboard →" button
- Pulsing green "All systems operational" status badge

**Fonts:** Syne (display, headings) + Plus Jakarta Sans (body)  
**Framework:** Next.js App Router, no external UI library, pure CSS modules

### Error States
| Scenario | UX |
|---|---|
| Wrong credentials | Toast: "Invalid email or password" (never reveals which) |
| Account locked | Toast: "Too many attempts. Try again in 15 minutes." |
| Session expired | Redirect to `/login?session=expired` → toast on load |
| Backend unreachable | Full-page error boundary: "Service temporarily unavailable" |

---

## Error Handling

- All FastAPI routes return structured `{detail: string, code: string}` JSON errors
- Webhook handlers are idempotent: duplicate `bolna_call_id` or `wa_message_id` → 200 OK, no duplicate processing
- All Celery tasks have `max_retries=3` with exponential backoff
- Unhandled exceptions → Sentry (configured via `SENTRY_DSN` env var, optional in Phase 1)

---

## Testing

- **Backend:** pytest + FastAPI `TestClient`. Phase 1 covers: login success, login failure, token refresh, lockout, seed script idempotency.
- **Migrations:** `alembic upgrade head` verified in CI pipeline before any deploy.
- **Frontend:** No automated tests in Phase 1. Manual smoke test checklist:
  - [ ] Login with correct credentials succeeds
  - [ ] Login with wrong password shows error toast
  - [ ] 6th failed attempt triggers lockout message
  - [ ] Session persists on browser refresh
  - [ ] Logout clears session and redirects to `/login`
  - [ ] Direct navigation to `/dashboard` redirects to `/login` when unauthenticated

---

## Environment Variables (`.env.example`)

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

# Admin seed
ADMIN_EMAIL=admin@bookingai.com
ADMIN_PASSWORD=changeme
ADMIN_NAME=Admin

# Integrations (stubs — filled in later phases)
BOLNA_API_KEY=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
GOOGLE_CALENDAR_CREDENTIALS_JSON=

# Optional
SENTRY_DSN=
```

---

## Phase Roadmap

| Phase | Scope |
|---|---|
| **1 (this)** | Scaffold + DB schema + Auth + Sign-in page |
| 2 | Appointment + availability APIs + Google Calendar sync |
| 3 | Bolna AI call integration (inbound + outbound) |
| 4 | WhatsApp integration (Meta Business API) |
| 5 | Lead outreach engine + Celery scheduled jobs |
| 6 | Analytics dashboard |
