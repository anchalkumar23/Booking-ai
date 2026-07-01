"""
Inbound call endpoints — called by Bolna AI mid-conversation via function tools.
These are NOT protected by JWT auth (Bolna calls them during live calls).
They are protected by a shared API key in the header instead.
"""
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.models.customer import Customer, Language
from app.models.location import Location
from app.models.staff import Staff
from app.services.availability import get_available_slots, find_available_staff
from app.services.appointment import create_appointment
from app.models.appointment import BookedVia
from app.models.suppression import SuppressionList

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/inbound", tags=["inbound"])
IST = ZoneInfo("Asia/Kolkata")


def _verify_bolna_key(x_bolna_api_key: str = Header(default="")):
    """Simple shared-key auth for Bolna function tool calls."""
    if settings.bolna_api_key and x_bolna_api_key != settings.bolna_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")


class CheckSlotsRequest(BaseModel):
    location_id: Optional[str] = None   # falls back to DEFAULT_LOCATION_ID in .env
    date: str           # "2026-05-08" or "2026-05-08T00:00:00"
    duration_mins: int = 60


class BookRequest(BaseModel):
    location_id: Optional[str] = None  # falls back to DEFAULT_LOCATION_ID in .env
    customer_phone: str
    customer_name: str
    service: str
    scheduled_at: str   # ISO datetime string e.g. "2026-05-08T10:00:00"
    duration_mins: int = 60
    language: str = "en"


@router.post("/check-slots")
def check_slots(
    body: CheckSlotsRequest,
    db: Session = Depends(get_db),
    _=Depends(_verify_bolna_key),
):
    """
    Called by Bolna 'Calendar Availability' function tool mid-conversation.
    Returns available time slots for a given date and location.
    """
    loc_id_str = body.location_id or settings.default_location_id
    if not loc_id_str:
        raise HTTPException(status_code=400, detail="No location_id provided and DEFAULT_LOCATION_ID not set in .env")
    try:
        location_id = uuid.UUID(loc_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid location_id")

    try:
        date = datetime.fromisoformat(body.date.split("T")[0])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    slots = get_available_slots(db, location_id, date, body.duration_mins)

    if not slots:
        return {
            "available": False,
            "message": "No slots available on this date.",
            "slots": [],
        }

    # Format slots for AI to read aloud naturally
    formatted = []
    for slot in slots[:8]:  # limit to 8 slots so AI doesn't list too many
        t = slot["time"]
        if hasattr(t, "astimezone"):
            t = t.astimezone(IST)
        formatted.append({
            "time": t.strftime("%I:%M %p") if hasattr(t, "strftime") else str(t),
            "datetime": t.isoformat() if hasattr(t, "isoformat") else str(t),
            "available_staff": slot["available_staff_count"],
        })

    return {
        "available": True,
        "message": f"{len(slots)} slots available.",
        "slots": formatted,
    }


@router.post("/book-appointment")
def book_appointment_inbound(
    body: BookRequest,
    db: Session = Depends(get_db),
    _=Depends(_verify_bolna_key),
):
    """
    Called by Bolna 'Book Appointment' function tool mid-conversation.
    Creates or finds the customer and books the appointment.
    """
    # Check suppression
    suppressed = db.query(SuppressionList).filter(
        SuppressionList.phone == body.customer_phone
    ).first()
    if suppressed:
        return {"success": False, "message": "This number has opted out of our services."}

    loc_id_str = body.location_id or settings.default_location_id
    if not loc_id_str:
        raise HTTPException(status_code=400, detail="No location_id provided and DEFAULT_LOCATION_ID not set in .env")
    try:
        location_id = uuid.UUID(loc_id_str)
        scheduled_at = datetime.fromisoformat(body.scheduled_at)
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=IST)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid input: {e}")

    # Map language string to enum
    lang_map = {"en": Language.en, "hi": Language.hi, "ta": Language.ta}
    language = lang_map.get(body.language, Language.en)

    # Find or create customer
    customer = db.query(Customer).filter(Customer.phone == body.customer_phone).first()
    if not customer:
        customer = Customer(
            location_id=location_id,
            full_name=body.customer_name,
            phone=body.customer_phone,
            language=language,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

    # Verify staff available
    staff = find_available_staff(db, location_id, scheduled_at, body.duration_mins)
    if not staff:
        return {
            "success": False,
            "message": "Sorry, that slot is no longer available. Please choose another time.",
        }

    try:
        appointment = create_appointment(
            db=db,
            customer_id=customer.id,
            location_id=location_id,
            service=body.service,
            scheduled_at=scheduled_at,
            duration_mins=body.duration_mins,
            booked_via=BookedVia.call,
        )

        # Send WhatsApp confirmation asynchronously
        from app.tasks.whatsapp_tasks import send_booking_confirmation_task
        send_booking_confirmation_task.delay(
            phone=customer.phone,
            customer_name=customer.full_name,
            service=body.service,
            scheduled_at=scheduled_at.astimezone(IST).strftime("%d %B %Y at %I:%M %p IST"),
            language=language.value,
            location_id=str(location_id),
        )

        return {
            "success": True,
            "appointment_id": str(appointment.id),
            "message": (
                f"Appointment confirmed! {body.customer_name} is booked for "
                f"{body.service} on {scheduled_at.astimezone(IST).strftime('%d %B at %I:%M %p IST')}. "
                f"A WhatsApp confirmation has been sent."
            ),
        }
    except HTTPException as e:
        return {"success": False, "message": e.detail.get("message", "Booking failed.")}
    except Exception as e:
        logger.error(f"Inbound booking failed: {e}")
        return {"success": False, "message": "Booking failed. Please try again."}
