import logging
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.appointment import Appointment, AppointmentStatus, BookedVia
from app.models.customer import Customer
from app.models.location import Location
from app.models.staff import Staff
from app.services.availability import find_available_staff
from app.integrations.google_calendar import create_event, update_event, delete_event

logger = logging.getLogger(__name__)


def _gcal_summary(service: str, customer_name: str) -> str:
    return f"{service} — {customer_name}"


def _gcal_description(service: str, customer_name: str, staff_name: str, location_name: str, booked_via: str) -> str:
    return (
        f"Service: {service}\n"
        f"Customer: {customer_name}\n"
        f"Staff: {staff_name}\n"
        f"Location: {location_name}\n"
        f"Booked via: {booked_via}"
    )


def _sync_create(db: Session, appointment: Appointment) -> None:
    """Create a Google Calendar event for a new appointment."""
    try:
        customer = db.query(Customer).filter(Customer.id == appointment.customer_id).first()
        location = db.query(Location).filter(Location.id == appointment.location_id).first()
        staff = db.query(Staff).filter(Staff.id == appointment.staff_id).first() if appointment.staff_id else None

        customer_name = customer.full_name if customer else "Customer"
        staff_name = staff.full_name if staff else "Staff"
        location_name = location.name if location else "Location"
        attendee_email = customer.email if customer else None

        event_id = create_event(
            summary=_gcal_summary(appointment.service, customer_name),
            description=_gcal_description(
                appointment.service, customer_name, staff_name,
                location_name, appointment.booked_via.value
            ),
            start=appointment.scheduled_at,
            duration_mins=appointment.duration_mins,
            attendee_email=attendee_email,
        )
        if event_id:
            appointment.gcal_event_id = event_id
            db.commit()
    except Exception as e:
        logger.error(f"GCal sync on create failed for appointment {appointment.id}: {e}")


def _sync_update(db: Session, appointment: Appointment) -> None:
    """Update the Google Calendar event when appointment is rescheduled."""
    if not appointment.gcal_event_id:
        _sync_create(db, appointment)
        return
    try:
        customer = db.query(Customer).filter(Customer.id == appointment.customer_id).first()
        location = db.query(Location).filter(Location.id == appointment.location_id).first()
        staff = db.query(Staff).filter(Staff.id == appointment.staff_id).first() if appointment.staff_id else None

        customer_name = customer.full_name if customer else "Customer"
        staff_name = staff.full_name if staff else "Staff"
        location_name = location.name if location else "Location"
        attendee_email = customer.email if customer else None

        update_event(
            event_id=appointment.gcal_event_id,
            summary=_gcal_summary(appointment.service, customer_name),
            description=_gcal_description(
                appointment.service, customer_name, staff_name,
                location_name, appointment.booked_via.value
            ),
            start=appointment.scheduled_at,
            duration_mins=appointment.duration_mins,
            attendee_email=attendee_email,
        )
    except Exception as e:
        logger.error(f"GCal sync on update failed for appointment {appointment.id}: {e}")


def _sync_delete(appointment: Appointment) -> None:
    """Delete the Google Calendar event when appointment is cancelled."""
    if appointment.gcal_event_id:
        try:
            delete_event(appointment.gcal_event_id)
        except Exception as e:
            logger.error(f"GCal sync on delete failed for appointment {appointment.id}: {e}")


def create_appointment(
    db: Session,
    customer_id: uuid.UUID,
    location_id: uuid.UUID,
    service: str,
    scheduled_at: datetime,
    duration_mins: int,
    booked_via: BookedVia,
) -> Appointment:
    staff = find_available_staff(db, location_id, scheduled_at, duration_mins)
    if not staff:
        raise HTTPException(
            status_code=409,
            detail={"message": "No staff available for this slot.", "code": "slot_unavailable"},
        )
    appointment = Appointment(
        customer_id=customer_id,
        location_id=location_id,
        staff_id=staff.id,
        service=service,
        scheduled_at=scheduled_at,
        duration_mins=duration_mins,
        booked_via=booked_via,
        status=AppointmentStatus.scheduled,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    # Sync to Google Calendar (non-blocking — errors are logged, not raised)
    _sync_create(db, appointment)

    return appointment


def reschedule_appointment(
    db: Session,
    appointment: Appointment,
    scheduled_at: datetime,
    duration_mins: int,
) -> Appointment:
    staff = find_available_staff(
        db, appointment.location_id, scheduled_at, duration_mins,
        exclude_appointment_id=appointment.id,
    )
    if not staff:
        raise HTTPException(
            status_code=409,
            detail={"message": "No staff available for this slot.", "code": "slot_unavailable"},
        )
    appointment.scheduled_at = scheduled_at
    appointment.duration_mins = duration_mins
    appointment.staff_id = staff.id
    db.commit()
    db.refresh(appointment)

    _sync_update(db, appointment)

    return appointment


def cancel_appointment(db: Session, appointment: Appointment) -> Appointment:
    if appointment.status == AppointmentStatus.cancelled:
        raise HTTPException(
            status_code=400,
            detail={"message": "Appointment is already cancelled.", "code": "invalid_status_transition"},
        )
    appointment.status = AppointmentStatus.cancelled
    db.commit()
    db.refresh(appointment)

    _sync_delete(appointment)

    return appointment
