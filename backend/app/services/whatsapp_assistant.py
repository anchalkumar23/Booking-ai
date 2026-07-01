import logging
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.customer import Customer, Language
from app.models.location import Location
from app.models.appointment import Appointment, AppointmentStatus, BookedVia
from app.models.whatsapp_message import WhatsAppMessage, WADirection
from app.services.availability import get_available_slots
from app.services import appointment as appointment_service
from app.integrations.llm import run_assistant

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")
HISTORY_LIMIT = 12
LANG_NAMES = {"en": "English", "hi": "Hindi", "ta": "Tamil"}


def get_or_create_customer(db: Session, phone: str, location_id: uuid.UUID) -> Customer:
    customer = db.query(Customer).filter(Customer.phone == phone).first()
    if customer:
        return customer
    customer = Customer(
        location_id=location_id,
        full_name="WhatsApp Customer",
        phone=phone,
        language=Language.en,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def _conversation_history(db: Session, phone: str) -> list[dict]:
    rows = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.phone == phone)
        .order_by(WhatsAppMessage.sent_at.desc())
        .limit(HISTORY_LIMIT)
        .all()
    )
    rows.reverse()
    return [
        {"role": "user" if row.direction == WADirection.inbound else "assistant", "content": row.body}
        for row in rows
    ]


def _tool_definitions() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": "check_availability",
                "description": "Check available appointment slots for a given date.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                        "duration_mins": {"type": "integer", "default": 60},
                    },
                    "required": ["date"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "book_appointment",
                "description": "Book a new appointment for the customer at a specific date and time.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "service": {"type": "string", "description": "Name of the service being booked"},
                        "scheduled_at": {"type": "string", "description": "ISO 8601 datetime, e.g. 2026-06-20T14:00:00"},
                        "duration_mins": {"type": "integer", "default": 60},
                    },
                    "required": ["service", "scheduled_at"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_my_appointments",
                "description": "List the customer's upcoming scheduled appointments.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "reschedule_appointment",
                "description": "Reschedule one of the customer's existing appointments to a new date/time.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "appointment_id": {"type": "string"},
                        "new_scheduled_at": {"type": "string", "description": "ISO 8601 datetime"},
                        "duration_mins": {"type": "integer", "default": 60},
                    },
                    "required": ["appointment_id", "new_scheduled_at"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "cancel_appointment",
                "description": "Cancel one of the customer's existing appointments.",
                "parameters": {
                    "type": "object",
                    "properties": {"appointment_id": {"type": "string"}},
                    "required": ["appointment_id"],
                },
            },
        },
    ]


def _parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt


def _make_tool_executor(db: Session, customer: Customer, location: Location):
    def execute(name: str, args: dict) -> dict:
        if name == "check_availability":
            date = _parse_dt(f"{args['date']}T00:00:00")
            slots = get_available_slots(db, location.id, date, args.get("duration_mins", 60))
            return {"slots": [s["time"].isoformat() for s in slots[:15]]}

        if name == "book_appointment":
            try:
                appt = appointment_service.create_appointment(
                    db, customer.id, location.id, args["service"],
                    _parse_dt(args["scheduled_at"]), args.get("duration_mins", 60),
                    BookedVia.whatsapp,
                )
                return {"status": "booked", "appointment_id": str(appt.id), "scheduled_at": appt.scheduled_at.isoformat()}
            except HTTPException as e:
                return {"status": "failed", "reason": e.detail}

        if name == "list_my_appointments":
            appts = (
                db.query(Appointment)
                .filter(Appointment.customer_id == customer.id, Appointment.status == AppointmentStatus.scheduled)
                .order_by(Appointment.scheduled_at)
                .all()
            )
            return {"appointments": [
                {"id": str(a.id), "service": a.service, "scheduled_at": a.scheduled_at.isoformat()}
                for a in appts
            ]}

        if name == "reschedule_appointment":
            appt = db.query(Appointment).filter(
                Appointment.id == args["appointment_id"], Appointment.customer_id == customer.id
            ).first()
            if not appt:
                return {"status": "failed", "reason": "appointment_not_found"}
            try:
                appt = appointment_service.reschedule_appointment(
                    db, appt, _parse_dt(args["new_scheduled_at"]),
                    args.get("duration_mins", appt.duration_mins),
                )
                return {"status": "rescheduled", "scheduled_at": appt.scheduled_at.isoformat()}
            except HTTPException as e:
                return {"status": "failed", "reason": e.detail}

        if name == "cancel_appointment":
            appt = db.query(Appointment).filter(
                Appointment.id == args["appointment_id"], Appointment.customer_id == customer.id
            ).first()
            if not appt:
                return {"status": "failed", "reason": "appointment_not_found"}
            try:
                appointment_service.cancel_appointment(db, appt)
                return {"status": "cancelled"}
            except HTTPException as e:
                return {"status": "failed", "reason": e.detail}

        return {"error": f"unknown_tool:{name}"}

    return execute


def _system_prompt(location: Location, customer: Customer) -> str:
    now_ist = datetime.now(IST)
    return (
        f"You are the WhatsApp booking assistant for {location.name}, a {location.type.value} in {location.city}.\n"
        f"Today's date and time is {now_ist.strftime('%Y-%m-%d %H:%M')} (Asia/Kolkata, IST) — "
        "resolve relative dates like 'tomorrow' or 'next Monday' against this.\n"
        f"Reply in {LANG_NAMES.get(customer.language.value, 'English')}, the customer's preferred language.\n"
        f"Business knowledge base:\n{location.knowledge_base or 'No additional information provided.'}\n\n"
        "Use the provided tools to check availability and book, reschedule, or cancel appointments. "
        "Always confirm the service, date, and time with the customer before calling book_appointment. "
        "Keep replies short and conversational, suitable for WhatsApp. If you can't help with something, "
        "tell the customer to call the business directly."
    )


def generate_reply(db: Session, phone: str, location: Location) -> str:
    customer = get_or_create_customer(db, phone, location.id)
    history = _conversation_history(db, phone)
    executor = _make_tool_executor(db, customer, location)
    system_prompt = _system_prompt(location, customer)
    return run_assistant(system_prompt, history, _tool_definitions(), executor)
