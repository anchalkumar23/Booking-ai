# CLAUDE.md — AI-Powered Business Automation System

## What We're Building

A production-grade AI-powered automation platform for a multi-location business client operating gyms, salons, and restaurants across South India. The system automates customer engagement through AI voice calls and WhatsApp — handling appointment booking, membership renewals, lead outreach, and reminders without manual staff involvement.

---

## Tech Stack

- **Backend:** Python (FastAPI)
- **Frontend:** Next.js (App Router)
- **Database:** PostgreSQL
- **Task Queue:** Celery + Redis (for background jobs and scheduling)
- **AI Voice & Calling:** Bolna AI
- **WhatsApp:** Meta WhatsApp Business Cloud API
- **Calendar:** Google Calendar API

---

## Languages Supported

English and Hindi (primary), Tamil (secondary). All voice agents and WhatsApp messages must support all three. Language preference is stored per customer and used automatically.

---

## Core Features

### AI Call Agent (via Bolna AI)
Handles both inbound and outbound calls. Inbound calls allow customers to book appointments. Outbound calls are used for appointment reminders, membership renewal follow-ups, and lead outreach. Calls are in the customer's preferred language. If the AI confidence is low (below 70%), the call transfers to a human agent. Missed or failed calls trigger an automatic callback within 2–5 minutes.

Call outcomes are detected from transcripts:
- **Booked / Rescheduled** → update appointment, sync Google Calendar, send WhatsApp confirmation
- **Busy / Call later** → schedule a retry after a configurable window
- **Not interested** → suppress customer from all future outreach
- **No answer / Missed** → auto-callback
- **Low confidence** → transfer to human

### Appointment Management
Real-time availability checking with double-booking prevention. Appointments sync with Google Calendar. Staff can manually edit or cancel appointments from the dashboard without breaking automation. Reminder calls are sent automatically 30–60 minutes before each appointment.

### Membership Management
Tracks membership expiry dates and payment status per customer per location. A daily background job identifies memberships expiring in 7, 3, and 1 days. Renewal calls are only initiated if payment is still pending. Customers are segmented by membership tier and location.

### Lead Generation & Outreach
Leads are imported via CSV or API. Each lead goes through a 4-step WhatsApp message sequence and a parallel Bolna cold calling campaign. Outcomes from both channels are synced — if a lead responds on WhatsApp, calling stops, and vice versa. Interested leads are flagged instantly for the sales team.

### WhatsApp Integration
Uses Meta-approved template messages for first contact, switching to session messages after a reply. Sends booking confirmations, payment receipts, and post-service feedback links. Detects opt-out keywords ("STOP", "not interested", "band karo", "வேண்டாம்") and suppresses the contact globally across all channels.

### Global Suppression Engine
A single suppression list enforced across all outbound channels (calls and WhatsApp). Once a contact opts out or says not interested through any channel, all outreach stops immediately — no double-touch, no channel overlap.

### Analytics Dashboard
Tracks the full funnel: Calls initiated → Connected → Completed → Converted → Paid. Also covers WhatsApp delivery/read/reply rates, booking success rates, no-show rates, and lead pipeline status. Filterable by location and date range.

---

## Compliance Requirements

- Check DND registry before any outbound call
- Log all opt-ins and opt-outs with timestamp and source
- Only use Meta-approved WhatsApp templates for first contact
- Respect WhatsApp throughput limits (rate limiting)
- All webhook handlers must be idempotent (safe to retry)
- Never initiate duplicate calls or sequences for the same contact
- High-volume outbound calling must comply with TRAI regulations and customer consent rules

---

## Key Business Rules

1. Never contact a suppressed number through any channel.
2. Never double-book an appointment slot.
3. If a customer replies on WhatsApp, stop all outbound calls to them.
4. If a customer books via a call, stop their WhatsApp sequence.
5. Always verify payment status before initiating a membership renewal call.
6. Always check DND registry before any outbound call.
7. Staff edits from the dashboard must not trigger duplicate automation.
8. Calls with confidence score below 70% must transfer to a human agent.