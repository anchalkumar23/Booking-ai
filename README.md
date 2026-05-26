# Booking AI — AI-Powered Business Automation Platform

A production-grade automation platform for a multi-location business (gyms, salons, restaurants) in South India. Automates customer engagement via AI voice calls and WhatsApp — handling appointment booking, membership renewals, lead outreach, and reminders without manual staff involvement.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 + FastAPI 0.115 |
| Frontend | Next.js 15 (App Router) + TypeScript |
| Database | PostgreSQL 16 |
| Task Queue | Celery 5 + Redis 7 |
| AI Voice | Bolna AI (outbound + inbound calls) |
| WhatsApp | Meta WhatsApp Business Cloud API |
| Calendar | Google Calendar API (Service Account) |
| Deployment | Docker Compose + Nginx (Hostinger VPS) |

---

## Languages Supported

English, Hindi, Tamil — stored per customer and used automatically for all calls and WhatsApp messages.

---

## Project Structure

```
booking-ai/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── api/v1/             # REST API endpoints
│   │   │   ├── auth.py         # Login, logout, refresh, /me
│   │   │   ├── locations.py    # Location CRUD
│   │   │   ├── staff.py        # Staff CRUD + working hours
│   │   │   ├── customers.py    # Customer CRUD
│   │   │   ├── appointments.py # Appointment CRUD + slot availability
│   │   │   ├── leads.py        # Lead CRUD + CSV import + outreach trigger
│   │   │   ├── analytics.py    # Dashboard metrics
│   │   │   ├── inbound.py      # Real-time Bolna function call endpoints
│   │   │   └── webhooks/
│   │   │       ├── bolna.py    # Bolna call outcome webhook
│   │   │       └── whatsapp.py # Meta WhatsApp webhook
│   │   ├── models/             # SQLAlchemy ORM models (10 tables)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic layer
│   │   │   ├── appointment.py  # Create/reschedule/cancel + GCal sync
│   │   │   ├── availability.py # Slot generation + conflict checking
│   │   │   └── lead.py         # Lead creation + outreach trigger
│   │   ├── tasks/              # Celery background tasks
│   │   │   ├── bolna_tasks.py  # Outbound call tasks
│   │   │   ├── whatsapp_tasks.py # WhatsApp sequence tasks
│   │   │   └── scheduled_tasks.py # Daily jobs (reminders, renewals)
│   │   ├── integrations/       # Third-party API clients
│   │   │   ├── bolna.py        # Bolna API client
│   │   │   ├── whatsapp.py     # Meta Graph API client
│   │   │   └── google_calendar.py # Google Calendar Service Account client
│   │   └── core/
│   │       ├── config.py       # Pydantic Settings (reads .env)
│   │       ├── database.py     # SQLAlchemy engine + session
│   │       └── security.py     # JWT, bcrypt, Redis lockout
│   ├── alembic/                # Database migrations
│   │   └── versions/
│   │       ├── 001_initial_schema.py  # All 10 tables
│   │       ├── 002_seed_admin.py      # Admin user from .env
│   │       └── 003_add_staff_and_staff_id.py  # Staff table
│   └── tests/                  # pytest test suite
├── frontend/                   # Next.js application
│   └── app/
│       ├── (auth)/login/       # Sign-in page
│       └── dashboard/          # Protected admin dashboard
│           ├── page.tsx        # Analytics overview
│           ├── appointments/   # Appointment management
│           ├── leads/          # Lead pipeline + outreach
│           ├── customers/      # Customer management
│           ├── staff/          # Staff + working hours
│           └── locations/      # Location management
├── nginx/nginx.conf            # Reverse proxy config
├── docker-compose.yml          # Production deployment
└── docker-compose.dev.yml      # Local dev (Postgres + Redis only)
```

---

## Local Development Setup

### Prerequisites
- Docker Desktop
- Python 3.12+
- Node.js 20+

### Step 1 — Clone & configure

```bash
# Copy env template
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials (see Environment Variables section)
```

### Step 2 — Start Postgres + Redis

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Step 3 — Backend

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head          # runs migrations + seeds admin user
python main.py                # starts FastAPI on http://localhost:8000
```

API docs: **http://localhost:8000/docs**

### Step 4 — Frontend

```bash
cd frontend
npm install
npm run dev                   # starts Next.js on http://localhost:3000
```

### Step 5 — Celery (for background jobs)

```bash
# Terminal 1 — Worker
cd backend && celery -A app.tasks.celery_app worker --loglevel=info

# Terminal 2 — Beat scheduler
cd backend && celery -A app.tasks.celery_app beat --loglevel=info
```

### Step 6 — ngrok (for Bolna + WhatsApp webhooks)

```bash
ngrok http 8000
# Copy the https URL → paste into Bolna Analytics tab and Meta webhook config
```

---

## Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://bookingai:bookingai123@localhost:5433/bookingai
REDIS_URL=redis://localhost:6379/0

# Auth (generate SECRET_KEY with: openssl rand -hex 32)
SECRET_KEY=your-64-char-secret-here
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Admin account (seeded once on first startup)
ADMIN_EMAIL=admin@yourbusiness.com
ADMIN_PASSWORD=StrongPassword123!
ADMIN_NAME=Admin Name

# Bolna AI
BOLNA_API_KEY=bn-xxxxxxxxxxxxxxx
BOLNA_REMINDER_AGENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
BOLNA_RENEWAL_AGENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
BOLNA_LEAD_AGENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
BOLNA_INBOUND_AGENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
BOLNA_INBOUND_PHONE=+91xxxxxxxxxx
BOLNA_WEBHOOK_SECRET=your-webhook-secret

# WhatsApp (Meta Business API)
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-permanent-access-token
WHATSAPP_VERIFY_TOKEN=your-verify-token

# Google Calendar
GOOGLE_CALENDAR_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com

# Default location (UUID from GET /api/v1/locations — used by inbound calls)
DEFAULT_LOCATION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional
SENTRY_DSN=
```

---

## Database Schema

10 tables, all with UUID primary keys:

| Table | Purpose |
|---|---|
| `users` | Single admin account |
| `locations` | Gym/salon/restaurant branches |
| `customers` | Customer profiles with language + suppression |
| `suppression_list` | Global opt-out list (all channels) |
| `staff` | Staff members with JSONB working hours |
| `appointments` | Bookings with Google Calendar event ID |
| `memberships` | Membership tiers with expiry + payment status |
| `leads` | Outreach prospects with sequence tracking |
| `call_logs` | Every call with outcome + transcript |
| `whatsapp_messages` | Every WA message with delivery status |
| `lead_sequence_steps` | Individual steps of 4-step WA sequence |

---

## API Reference

All endpoints under `/api/v1/`. Auth required (httpOnly JWT cookie) except webhooks and inbound.

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Login with email + password |
| POST | `/auth/logout` | Clear session |
| POST | `/auth/refresh` | Refresh access token silently |
| GET | `/auth/me` | Get current user info |

### Core Resources
| Resource | Endpoints |
|---|---|
| Locations | GET, POST `/locations` · GET, PUT, PATCH(deactivate) `/locations/{id}` |
| Staff | GET, POST `/staff` · GET, PUT, PATCH(deactivate) `/staff/{id}` |
| Customers | GET, POST `/customers` · GET, PUT `/customers/{id}` |
| Appointments | GET `/appointments/slots` · GET, POST `/appointments` · GET, PUT, PATCH(cancel) `/appointments/{id}` |
| Leads | GET, POST `/leads` · POST `/leads/import` · GET, PUT, PATCH(stop/convert) `/leads/{id}` |
| Analytics | GET `/analytics/overview` |

### Inbound (called by Bolna mid-conversation)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/inbound/check-slots` | Get available slots for a date |
| POST | `/inbound/book-appointment` | Create appointment during live call |

### Webhooks (called by external services)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/webhooks/bolna/call-outcome` | Process Bolna call result |
| GET | `/webhooks/whatsapp/verify` | Meta webhook verification |
| POST | `/webhooks/whatsapp/verify` | Receive WhatsApp messages |

---

## Feature Walkthrough

### 1. Appointment Booking Flow

**Via dashboard:**
1. Go to Appointments → New Appointment
2. Select location, customer, service, date
3. System shows real-time available slots (based on staff working hours)
4. Confirm → appointment created, Google Calendar event created, WhatsApp confirmation sent

**Via inbound call (customer calls your Bolna number):**
1. Customer calls `+918035375434`
2. AI greets and asks what they need
3. Customer says they want to book → AI asks for details
4. AI calls `POST /inbound/check-slots` to check availability
5. AI confirms slot → calls `POST /inbound/book-appointment`
6. Appointment created in DB + GCal, WhatsApp confirmation sent automatically

### 2. Appointment Reminder Flow

Every 15 minutes, Celery beat runs `schedule_appointment_reminders`:
1. Finds appointments starting in 30–75 minutes that haven't been reminded
2. For each: checks suppression + DND flags
3. Fires `send_reminder_call` Celery task → Bolna outbound call
4. Sets `reminder_sent = True` immediately (prevents duplicates)
5. Customer picks up → AI confirms appointment
6. Outcome logged → if no-answer, auto-retry in 5 minutes

### 3. Membership Renewal Flow

Every day at 9am IST, Celery beat runs `check_expiring_memberships`:
1. Finds memberships expiring in exactly 1, 3, or 7 days
2. Only processes those with `payment_status = pending`
3. Only processes those with `renewal_call_sent = False`
4. Fires `send_renewal_call` Celery task → Bolna outbound call
5. If not interested → global suppression

### 4. Lead Outreach Flow

When a lead is added (single or CSV import):
1. Suppression check — skip if on suppression list
2. WhatsApp 4-step sequence starts immediately:
   - Step 1 (day 0): Introduction template
   - Step 2 (day 2): Follow-up template
   - Step 3 (day 4): Special offer template
   - Step 4 (day 6): Last chance template
3. Bolna cold call fires 30 seconds after WA step 1
4. Cross-channel sync: if WA reply → `call_stopped = true` / if call converts → `wa_stopped = true`
5. Opt-out on either channel → global suppression

### 5. Global Suppression Engine

Single `suppression_list` table enforced everywhere:
- Every outbound call task checks suppression before dialling
- Every WhatsApp send checks suppression before sending
- Opt-out detected from: call transcript, WA keywords (STOP, not interested, band karo, வேண்டாம்)
- Customer's `is_suppressed` flag is denormalized for fast queries

### 6. WhatsApp Integration

**First contact:** Template messages (Meta-approved) — works outside 24h window  
**After reply:** Session messages — free-form text within 24h window

**Required templates (15 total — submit to Meta for approval):**

| Template | Purpose |
|---|---|
| `booking_confirmation_en/hi/ta` | Appointment confirmed |
| `lead_intro_en/hi/ta` | Step 1 — introduction |
| `lead_followup_en/hi/ta` | Step 2 — follow up |
| `lead_offer_en/hi/ta` | Step 3 — special offer |
| `lead_lastchance_en/hi/ta` | Step 4 — last chance |

---

## Bolna Agent Setup

Three outbound agents + one inbound agent:

| Agent | Name in Bolna | Used for |
|---|---|---|
| Reminder | `booking-ai-reminder` | 30–60 min pre-appointment calls |
| Renewal | `booking-ai-renewal` | Membership expiry calls |
| Lead | `booking-ai-lead-outreach` | Cold outreach calls |
| Inbound | `booking-ai-inbound` | Customer calls in to book |

**Inbound agent function tools:**
- `check_availability` → `POST /api/v1/inbound/check-slots`
- `book_appointment` → `POST /api/v1/inbound/book-appointment`
- Auth header: `X-Bolna-Api-Key: <your bolna api key>`

---

## Google Calendar Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project → Enable **Google Calendar API**
3. Create a **Service Account** → download JSON key
4. Share the client's Google Calendar with the service account email (Make changes to events permission)
5. Paste the entire JSON as `GOOGLE_CALENDAR_CREDENTIALS_JSON` in `.env`
6. Set `GOOGLE_CALENDAR_ID` to the calendar ID

---

## WhatsApp Setup

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → Add WhatsApp
2. Copy **Phone Number ID** and **Access Token** → add to `.env`
3. Set webhook URL: `https://your-domain.com/api/v1/webhooks/whatsapp/verify`
4. Subscribe to `messages` field
5. Submit 15 templates for Meta approval (templates are in SUMMARY.md)
6. Complete Meta Business Verification for production volume

---

## Production Deployment (Hostinger VPS)

```bash
# On your Hostinger VPS
git clone your-repo booking-ai
cd booking-ai

# Create production .env
cp backend/.env.example backend/.env
# Edit .env with production values

# Deploy
docker compose up --build -d

# Check logs
docker compose logs -f fastapi
docker compose logs -f celery
```

Nginx routes:
- `/*` → Next.js (port 3000)
- `/api/*` → FastAPI (port 8000)

For SSL: add Certbot or use Hostinger's built-in SSL.

---

## Security

- JWT access tokens (30 min) + refresh tokens (7 days) in httpOnly cookies
- bcrypt password hashing (cost factor 12)
- Redis-based lockout: 5 failed attempts → 15 minute block
- HMAC signature verification on Bolna webhooks
- No registration endpoint — admin seeded from `.env` only
- All webhook handlers idempotent (duplicate-safe via unique IDs)
- Global suppression enforced at service layer before any outbound action
