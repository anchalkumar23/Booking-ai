# What is Built

---

## The Big Picture

Gethyn runs gyms, salons, and restaurants across South India. Right now, staff spend hours every day calling customers to remind them of appointments, chasing people whose memberships are about to expire, and following up with new leads. Most of these calls go unanswered. A lot of leads never get contacted at all.

I built a system that does all of this automatically — 24 hours a day, 7 days a week — without any staff involvement. An AI speaks to customers in their own language (English, Hindi, or Tamil), books appointments, sends WhatsApp messages, and updates everything in a live dashboard that the business owner can see at any time.

---

## What Happens Automatically

### 1. Appointment Reminders
When a customer has an appointment coming up, the system automatically calls them 30–60 minutes before. An AI voice (powered by Bolna AI) reminds them of the time and location. If the customer doesn't pick up, the system tries again in 5 minutes. If the line is busy, it tries again in 30 minutes. Everything is logged.

### 2. Membership Renewal
Every morning at 9am, the system checks which memberships are expiring in 7 days, 3 days, or 1 day. If a customer hasn't paid yet, the AI automatically calls them and reminds them to renew. No one has to manually check a spreadsheet or make these calls.

### 3. New Lead Follow-Up
When a new potential customer (lead) is added — either one at a time or by uploading a spreadsheet — two things happen immediately:

- The system sends a WhatsApp message introducing your business.
- The AI calls the lead to have a conversation.

If there's no reply to the first WhatsApp message, the system sends follow-up messages on day 2, day 4, and day 6 automatically. If the lead replies on WhatsApp, calling stops. If the lead books via a phone call, WhatsApp messages stop. The two channels are always in sync so customers are never bombarded from both sides at once.

### 4. Appointment Booking During a Call
When an AI call is in progress and the customer says they want to book, the AI checks real-time availability and books the appointment right there — during the live call. No hold music, no "I'll call you back." The customer gets a WhatsApp confirmation immediately after.

### 5. Inbound Calls
Customers can also call your business number and the AI picks up, speaks with them in their language, checks available slots, and books the appointment — all without any staff involvement.

---

## How the AI Knows What to Say

We set up three separate AI agents (think of them as three different AI employees) in the Bolna AI platform:

- **Reminder Agent** — knows how to remind customers about upcoming appointments
- **Renewal Agent** — knows how to talk about membership expiry and payment
- **Lead Agent** — knows how to introduce the business and qualify new leads

Each agent speaks English, Hindi, and Tamil. The system automatically uses the customer's preferred language.

If the AI isn't confident it understood the customer correctly (below 70% confidence), it immediately transfers the call to a real human staff member. No guessing.

---

## WhatsApp Messaging

The system sends WhatsApp messages for:
- Booking confirmations (after any appointment is booked)
- Lead follow-up sequences (days 0, 2, 4, 6)

These messages use pre-approved templates — this is a requirement from Meta (WhatsApp's owner) to prevent spam. All 15 template messages (5 types × 3 languages) were defined and submitted for approval.

If a customer replies "STOP", "not interested", "band karo", or "வேண்டாம்" — they are immediately added to a global block list and never contacted again through any channel.

---

## The Dashboard

The business owner logs in at the web address with a single admin account. From the dashboard they can see and do everything:

- **Analytics** — How many calls were made, how many connected, how many resulted in bookings. WhatsApp message delivery and read rates. Appointment no-show rates. All filterable by location and date.
- **Appointments** — See all upcoming appointments, manually book one, cancel one. Staff schedules and availability are managed here.
- **Leads** — See all leads in the pipeline, what stage they're at, add new ones, upload a CSV file of hundreds at once. Convert a lead to a full customer when they're ready.
- **Customers** — Full customer list with search, contact history, language preference.
- **Staff** — Add staff members, set their working hours for each day of the week. The system uses this to know when slots are actually available.
- **Locations** — Manage each gym, salon, or restaurant as a separate location. Each has its own staff and availability.

---

## Protecting Customers From Being Spammed

There is a single global block list. Once anyone says "not interested" or asks to stop being contacted — through a phone call, a WhatsApp message, or manually — they are added to this list and the system will never contact them again through any channel. This is enforced automatically every single time before any message is sent or call is made.

---

## Google Calendar

Every appointment that is booked through the system automatically appears in the business's Google Calendar. If an appointment is rescheduled or cancelled, the calendar is updated instantly. Staff can see their appointments in the calendar app they already use.

---

## What's Still Needed Before Going Live

**WhatsApp Business Verification** — Meta needs to verify your client's business. Once approved, all 15 message templates go live. Until then, WhatsApp messages are simulated (they show in logs but don't actually send).


---

## What's Already Working Right Now

Everything else is fully built and tested:

- Admin login with security lockout (5 failed attempts = 15 minute block)
- All 6 dashboard pages with live data
- Full appointment booking with double-booking prevention
- Reminder and renewal call scheduling
- Lead outreach with 4-step WhatsApp sequences
- Bolna AI call agents with English, Hindi, Tamil prompts
- Inbound call booking via Bolna function tools
- Webhook processing for call outcomes (retry logic, suppression)
- WhatsApp message sending with opt-out detection
- Google Calendar sync
- Global suppression enforcement across all channels

---

## In One Sentence

I built a system that replaces hours of daily staff phone calls with an AI that speaks three languages, books appointments, follows up with leads, and sends WhatsApp messages — all automatically — while showing everything in a clean dashboard the owner can check from anywhere.
