from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import uuid

from app.core.database import get_db
from app.models.location import Location
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.lead import Lead
from app.models.call_log import CallLog
from app.core.security import verify_password, is_locked_out, record_failed_attempt, clear_failed_attempts, LOCKOUT_MAX_ATTEMPTS

router = APIRouter(prefix="/portal", tags=["portal"])


class PortalAuth(BaseModel):
    location_id: uuid.UUID
    password: str


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")


def _verify_location_access(db: Session, request: Request, location_id: uuid.UUID, password: str) -> Location:
    # Rate-limit per (IP + location) so a portal password can't be brute-forced.
    lock_key = f"portal:{_client_ip(request)}:{location_id}"
    if is_locked_out(lock_key):
        raise HTTPException(status_code=429, detail={"message": "Too many attempts. Try again in 15 minutes.", "code": "locked_out"})

    location = db.query(Location).filter(Location.id == location_id).first()
    if not location or not location.password_hash or not verify_password(password, location.password_hash):
        count = record_failed_attempt(lock_key)
        if not location:
            raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
        if count >= LOCKOUT_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail={"message": "Too many attempts. Try again in 15 minutes.", "code": "locked_out"})
        raise HTTPException(status_code=401, detail={"message": "Invalid location password.", "code": "invalid_password"})

    clear_failed_attempts(lock_key)
    return location


@router.get("/locations")
def portal_locations(db: Session = Depends(get_db)):
    locations = db.query(Location).filter(Location.is_active == True).order_by(Location.name).all()
    return [{"id": str(l.id), "name": l.name, "city": l.city, "type": l.type.value} for l in locations]


@router.post("/login")
def portal_login(body: PortalAuth, request: Request, db: Session = Depends(get_db)):
    location = _verify_location_access(db, request, body.location_id, body.password)
    return {
        "id": str(location.id),
        "name": location.name,
        "type": location.type.value,
        "city": location.city,
    }


@router.post("/overview")
def portal_overview(body: PortalAuth, request: Request, db: Session = Depends(get_db)):
    location_id = body.location_id
    location = _verify_location_access(db, request, location_id, body.password)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    soon_cutoff = now + timedelta(hours=2)

    # Today's appointments
    appts = (
        db.query(Appointment)
        .filter(
            Appointment.location_id == location_id,
            Appointment.scheduled_at >= today_start,
            Appointment.scheduled_at < today_end,
        )
        .order_by(Appointment.scheduled_at)
        .all()
    )

    customer_ids = {a.customer_id for a in appts}
    customers = {
        c.id: c for c in db.query(Customer).filter(Customer.id.in_(customer_ids)).all()
    } if customer_ids else {}

    today_appointments = [
        {
            "id": str(a.id),
            "customer_name": customers.get(a.customer_id).full_name if customers.get(a.customer_id) else "Unknown",
            "service": a.service,
            "scheduled_at": a.scheduled_at.isoformat(),
            "status": a.status.value,
        }
        for a in appts
    ]

    # Upcoming tasks (appointments in the next 2 hours that still need a reminder call)
    upcoming_tasks = [
        {
            "type": "reminder_call",
            "title": f"Call {customers.get(a.customer_id).full_name if customers.get(a.customer_id) else 'customer'} — {a.service} reminder",
            "scheduled_at": a.scheduled_at.isoformat(),
        }
        for a in appts
        if a.scheduled_at <= soon_cutoff and a.scheduled_at >= now and not a.reminder_sent
    ]

    # Phones belonging to this location (customers + leads)
    location_phones = set(
        p for (p,) in db.query(Customer.phone).filter(Customer.location_id == location_id).all()
    )
    location_phones |= set(
        p for (p,) in db.query(Lead.phone).filter(Lead.location_id == location_id).all()
    )

    recent_calls = []
    if location_phones:
        calls = (
            db.query(CallLog)
            .filter(CallLog.phone.in_(location_phones))
            .order_by(CallLog.called_at.desc())
            .limit(10)
            .all()
        )
        recent_calls = [
            {
                "id": str(c.id),
                "phone": c.phone,
                "purpose": c.purpose.value,
                "outcome": c.outcome.value if c.outcome else None,
                "summary": c.summary,
                "transcript": c.transcript,
                "called_at": c.called_at.isoformat() if c.called_at else None,
            }
            for c in calls
        ]

    return {
        "location": {"id": str(location.id), "name": location.name, "type": location.type.value, "city": location.city},
        "today_appointments": today_appointments,
        "upcoming_tasks": upcoming_tasks,
        "recent_calls": recent_calls,
    }
