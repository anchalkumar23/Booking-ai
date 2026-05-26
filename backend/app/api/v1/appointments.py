from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.appointment import (
    AppointmentCreate, AppointmentUpdate, AppointmentOut, SlotOut
)
from app.services.availability import get_available_slots
from app.services.appointment import (
    create_appointment, reschedule_appointment, cancel_appointment
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("/slots", response_model=List[SlotOut])
def available_slots(
    location_id: uuid.UUID,
    date: datetime,
    duration_mins: int = Query(default=60, ge=15, le=480),
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    return get_available_slots(db, location_id, date, duration_mins)


@router.get("", response_model=List[AppointmentOut])
def list_appointments(
    location_id: Optional[uuid.UUID] = None,
    date: Optional[datetime] = None,
    status: Optional[AppointmentStatus] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    q = db.query(Appointment)
    if location_id:
        q = q.filter(Appointment.location_id == location_id)
    if date:
        # Treat the incoming date as IST — filter from IST midnight to IST end-of-day
        ist_date = date.replace(tzinfo=IST) if date.tzinfo is None else date.astimezone(IST)
        day_start = ist_date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = ist_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        q = q.filter(
            Appointment.scheduled_at >= day_start,
            Appointment.scheduled_at < day_end,
        )
    if status:
        q = q.filter(Appointment.status == status)
    return q.order_by(Appointment.scheduled_at).all()


@router.post("", response_model=AppointmentOut, status_code=201)
def book_appointment(
    body: AppointmentCreate,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    return create_appointment(
        db,
        customer_id=body.customer_id,
        location_id=body.location_id,
        service=body.service,
        scheduled_at=body.scheduled_at,
        duration_mins=body.duration_mins,
        booked_via=body.booked_via,
    )


@router.get("/{appointment_id}", response_model=AppointmentOut)
def get_appointment(appointment_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail={"message": "Appointment not found.", "code": "not_found"})
    return appt


@router.put("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentUpdate,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail={"message": "Appointment not found.", "code": "not_found"})
    if body.scheduled_at or body.duration_mins:
        new_time = body.scheduled_at or appt.scheduled_at
        new_duration = body.duration_mins or appt.duration_mins
        appt = reschedule_appointment(db, appt, new_time, new_duration)
    if body.service:
        appt.service = body.service
    if body.status:
        appt.status = body.status
    db.commit()
    db.refresh(appt)
    return appt


@router.patch("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel(appointment_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail={"message": "Appointment not found.", "code": "not_found"})
    return cancel_appointment(db, appt)
