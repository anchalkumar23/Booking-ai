# Phase 2 Design Spec — Appointments + Staff + Availability APIs

**Project:** Booking AI  
**Date:** 2026-05-06  
**Phase:** 2 of 6

---

## Overview

Phase 2 delivers all core business APIs needed to book and manage appointments. It introduces staff management, a real-time availability engine (slot checker), and full appointment CRUD. Google Calendar sync is deferred — a `gcal_event_id` field already exists on appointments from Phase 1 and will be populated in a future phase.

---

## New Database Table — `staff`

A new `staff` table is added via Alembic migration `003`. All other tables were created in Phase 1.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| location_id | UUID FK → locations | |
| full_name | VARCHAR | |
| phone | VARCHAR | |
| working_hours | JSONB | `{"mon":{"start":"09:00","end":"18:00"}, ...}` — null key means day off |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMP | |

**`working_hours` shape:**
```json
{
  "mon": {"start": "09:00", "end": "18:00"},
  "tue": {"start": "09:00", "end": "18:00"},
  "wed": null,
  "thu": {"start": "09:00", "end": "18:00"},
  "fri": {"start": "09:00", "end": "18:00"},
  "sat": {"start": "10:00", "end": "15:00"},
  "sun": null
}
```
A `null` value for a day means the staff member does not work that day.

---

## API Endpoints

All routes are under `/api/v1/` and require a valid `access_token` cookie (from Phase 1 auth).

### Locations
| Method | Path | Description |
|---|---|---|
| GET | `/locations` | List all locations |
| POST | `/locations` | Create location |
| GET | `/locations/{id}` | Get one location |
| PUT | `/locations/{id}` | Update location |
| PATCH | `/locations/{id}/deactivate` | Soft-delete (sets `is_active=false`) |

### Staff
| Method | Path | Description |
|---|---|---|
| GET | `/staff` | List staff (filter: `?location_id=`) |
| POST | `/staff` | Create staff member |
| GET | `/staff/{id}` | Get one staff member |
| PUT | `/staff/{id}` | Update staff member |
| PATCH | `/staff/{id}/deactivate` | Soft-delete |

### Customers
| Method | Path | Description |
|---|---|---|
| GET | `/customers` | List customers (filter: `?location_id=&search=`) |
| POST | `/customers` | Create customer |
| GET | `/customers/{id}` | Get one customer |
| PUT | `/customers/{id}` | Update customer |

### Appointments
| Method | Path | Description |
|---|---|---|
| GET | `/appointments/slots` | Get available slots for a date + location |
| GET | `/appointments` | List appointments (filter: `?location_id=&date=&status=`) |
| POST | `/appointments` | Create appointment (auto-assigns staff) |
| GET | `/appointments/{id}` | Get one appointment |
| PUT | `/appointments/{id}` | Reschedule or update status |
| PATCH | `/appointments/{id}/cancel` | Cancel appointment |

---

## Availability Engine

`GET /api/v1/appointments/slots?location_id=&date=&duration_mins=60`

**Algorithm:**
1. Load all active staff for `location_id`
2. Get day-of-week from `date` (e.g. `"mon"`)
3. For each staff member, read `working_hours[day]` — skip if `null`
4. Generate candidate slots every `duration_mins` minutes within their working window
5. For each candidate slot, query `appointments` table for any row where:
   - `location_id` matches AND `status` is `scheduled`
   - `scheduled_at < slot_end` AND `scheduled_at + duration_mins > slot_start` (overlap check)
   - The assigned `staff_id` matches (added to appointments table — see below)
6. A slot is **available** if at least one staff member has no conflicting appointment in that window
7. Return list of `{time, available_staff_count}` objects sorted by time

**Appointment creation auto-assigns staff:**
When `POST /appointments` is called, the service picks the first available staff member for the requested slot using the same overlap logic. If no staff is free, returns `409 Conflict`.

---

## Schema Change — `staff_id` on `appointments`

The `appointments` table gets a new nullable column `staff_id UUID FK → staff` added via migration `003`. This is needed to track which staff member is assigned so the availability engine can check per-staff conflicts.

---

## Key Business Rules

1. A slot is only offered if at least one staff member is free at that time.
2. Creating an appointment atomically checks + claims a staff member to prevent race conditions (using `SELECT FOR UPDATE`).
3. Staff edits (working hours change, deactivation) do **not** cancel existing appointments — staff changes are forward-looking only.
4. Cancelled appointments free up their slot immediately.
5. The `uq_location_slot` unique constraint from Phase 1 is **removed** — it was too strict. With staff-based booking, the same location can have multiple appointments at the same time (one per staff member). Conflict is now enforced at the staff level via the availability engine.

---

## Error Responses

All errors return `{detail: {message: string, code: string}}`:

| Scenario | Status | Code |
|---|---|---|
| No staff available for slot | 409 | `slot_unavailable` |
| Location not found | 404 | `not_found` |
| Invalid date format | 422 | (Pydantic validation) |
| Appointment not found | 404 | `not_found` |
| Cancel already-cancelled appointment | 400 | `invalid_status_transition` |

---

## File Structure

```
backend/
├── alembic/versions/
│   └── 003_add_staff_and_staff_id.py     # staff table + staff_id on appointments
├── app/
│   ├── models/
│   │   └── staff.py                       # Staff model
│   ├── schemas/
│   │   ├── location.py
│   │   ├── staff.py
│   │   ├── customer.py
│   │   └── appointment.py
│   ├── services/
│   │   ├── availability.py                # Slot generation + conflict check
│   │   └── appointment.py                 # Create, update, cancel logic
│   └── api/v1/
│       ├── locations.py
│       ├── staff.py
│       ├── customers.py
│       ├── appointments.py
│       └── router.py                      # Updated to include all new routers
```

---

## Google Calendar (Deferred)

`gcal_event_id` column already exists on `appointments`. When Phase 2.5 implements Calendar sync:
- On appointment create → create GCal event, store `gcal_event_id`
- On reschedule → update GCal event
- On cancel → delete GCal event

No code changes to the appointment schema needed — the column is already there.
