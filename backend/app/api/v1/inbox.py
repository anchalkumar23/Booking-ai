import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.whatsapp_message import WhatsAppMessage, WADirection, WAMessageType, WAStatus
from app.models.customer import Customer
from app.models.lead import Lead
from app.models.location import Location
from app.integrations.whatsapp import send_text_message, credentials_from_location

router = APIRouter(prefix="/inbox", tags=["inbox"])

WINDOW = timedelta(hours=24)


def _name_map(db: Session, phones: list[str]) -> dict:
    """Resolve phone -> display name from customers, then leads."""
    names: dict[str, str] = {}
    if not phones:
        return names
    for lead in db.query(Lead).filter(Lead.phone.in_(phones)).all():
        names.setdefault(lead.phone, lead.full_name)
    for c in db.query(Customer).filter(Customer.phone.in_(phones)).all():
        names[c.phone] = c.full_name  # customer name wins over lead
    return names


@router.get("/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    """Most-recent WhatsApp conversation per phone (newest first)."""
    # Pull recent messages and fold to one row per phone in Python (fine for v1 volumes).
    rows = (
        db.query(WhatsAppMessage)
        .order_by(WhatsAppMessage.sent_at.desc())
        .limit(2000)
        .all()
    )
    now = datetime.now(timezone.utc)
    convos: dict[str, dict] = {}
    last_inbound: dict[str, datetime] = {}
    for m in rows:
        if m.phone not in convos:
            convos[m.phone] = {
                "phone": m.phone,
                "last_body": m.body,
                "last_direction": m.direction.value,
                "last_at": m.sent_at.isoformat() if m.sent_at else None,
            }
        if m.direction == WADirection.inbound and m.phone not in last_inbound:
            last_inbound[m.phone] = m.sent_at

    names = _name_map(db, list(convos.keys()))
    out = []
    for phone, c in convos.items():
        li = last_inbound.get(phone)
        c["name"] = names.get(phone)
        c["within_window"] = bool(li and (now - li) < WINDOW)
        out.append(c)
    out.sort(key=lambda x: x["last_at"] or "", reverse=True)
    return {"conversations": out}


@router.get("/conversations/{phone}")
def get_conversation(
    phone: str,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    msgs = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.phone == phone)
        .order_by(WhatsAppMessage.sent_at.asc())
        .all()
    )
    now = datetime.now(timezone.utc)
    last_inbound = None
    for m in msgs:
        if m.direction == WADirection.inbound:
            last_inbound = m.sent_at
    names = _name_map(db, [phone])
    return {
        "phone": phone,
        "name": names.get(phone),
        "within_window": bool(last_inbound and (now - last_inbound) < WINDOW),
        "messages": [
            {
                "direction": m.direction.value,
                "type": m.message_type.value,
                "template_name": m.template_name,
                "body": m.body,
                "status": m.status.value,
                "sent_at": m.sent_at.isoformat() if m.sent_at else None,
            }
            for m in msgs
        ],
    }


class ReplyBody(BaseModel):
    location_id: uuid.UUID
    text: str


@router.post("/conversations/{phone}/reply")
def reply_conversation(
    phone: str,
    body: ReplyBody,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    """Send a free-form (session) reply. Only valid within 24h of the customer's last
    inbound message — outside that window WhatsApp requires a template (use Campaigns)."""
    if not body.text.strip():
        raise HTTPException(status_code=400, detail={"message": "Message is empty.", "code": "empty"})

    now = datetime.now(timezone.utc)
    last_inbound = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.phone == phone, WhatsAppMessage.direction == WADirection.inbound)
        .order_by(WhatsAppMessage.sent_at.desc())
        .first()
    )
    if not last_inbound or (now - last_inbound.sent_at) >= WINDOW:
        raise HTTPException(
            status_code=400,
            detail={"message": "The 24-hour reply window is closed. Send an approved template via Campaigns instead.", "code": "window_closed"},
        )

    location = db.query(Location).filter(Location.id == body.location_id).first()
    creds = credentials_from_location(location)
    wa_pid = creds.phone_number_id if creds else None
    wa_token = creds.access_token if creds else None

    result = send_text_message(phone=phone, text=body.text, phone_number_id=wa_pid, access_token=wa_token)
    wa_message_id = result.get("messages", [{}])[0].get("id", f"reply_{int(now.timestamp())}")
    msg = WhatsAppMessage(
        wa_message_id=wa_message_id,
        phone=phone,
        direction=WADirection.outbound,
        message_type=WAMessageType.session,
        body=body.text,
        status=WAStatus.sent,
    )
    db.add(msg)
    db.commit()
    return {"status": "sent", "wa_message_id": wa_message_id}
