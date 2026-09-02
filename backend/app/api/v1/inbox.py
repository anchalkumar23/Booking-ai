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
from app.models.inbox_extras import ConversationState, ConvStatus, CannedReply
from app.integrations.whatsapp import send_text_message, credentials_from_location

router = APIRouter(prefix="/inbox", tags=["inbox"])

WINDOW = timedelta(hours=24)


def _state_map(db: Session, phones: list[str]) -> dict:
    if not phones:
        return {}
    rows = db.query(ConversationState).filter(ConversationState.phone.in_(phones)).all()
    return {r.phone: r for r in rows}


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
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    """Most-recent WhatsApp conversation per phone (newest first). Optional ?status=open|resolved."""
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
    states = _state_map(db, list(convos.keys()))
    out = []
    for phone, c in convos.items():
        li = last_inbound.get(phone)
        state = states.get(phone)
        c["name"] = names.get(phone)
        c["within_window"] = bool(li and (now - li) < WINDOW)
        c["status"] = state.status.value if state else "open"
        c["ai_enabled"] = state.ai_enabled if state else True
        if status and c["status"] != status:
            continue
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
    state = _state_map(db, [phone]).get(phone)
    return {
        "phone": phone,
        "name": names.get(phone),
        "status": state.status.value if state else "open",
        "ai_enabled": state.ai_enabled if state else True,
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


class StatusBody(BaseModel):
    status: ConvStatus


@router.post("/conversations/{phone}/status")
def set_status(
    phone: str,
    body: StatusBody,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    state = db.query(ConversationState).filter(ConversationState.phone == phone).first()
    if not state:
        state = ConversationState(phone=phone, status=body.status)
        db.add(state)
    else:
        state.status = body.status
        state.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"phone": phone, "status": body.status.value}


class AiToggleBody(BaseModel):
    ai_enabled: bool


@router.post("/conversations/{phone}/ai")
def set_ai_enabled(
    phone: str,
    body: AiToggleBody,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    """Pause or resume the AI assistant's auto-replies for one conversation.
    A paused conversation still shows in the inbox for a human to reply manually."""
    state = db.query(ConversationState).filter(ConversationState.phone == phone).first()
    if not state:
        state = ConversationState(phone=phone, ai_enabled=body.ai_enabled)
        db.add(state)
    else:
        state.ai_enabled = body.ai_enabled
        state.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"phone": phone, "ai_enabled": body.ai_enabled}


# ---- Canned (quick) replies ----

@router.get("/canned")
def list_canned(
    location_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    q = db.query(CannedReply)
    if location_id:
        q = q.filter((CannedReply.location_id == location_id) | (CannedReply.location_id.is_(None)))
    rows = q.order_by(CannedReply.created_at.desc()).all()
    return {"canned": [{"id": str(r.id), "title": r.title, "body": r.body} for r in rows]}


class CannedBody(BaseModel):
    location_id: Optional[uuid.UUID] = None
    title: str
    body: str


@router.post("/canned", status_code=201)
def create_canned(
    body: CannedBody,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    if not body.title.strip() or not body.body.strip():
        raise HTTPException(status_code=400, detail={"message": "Title and body are required.", "code": "invalid"})
    r = CannedReply(location_id=body.location_id, title=body.title.strip(), body=body.body.strip())
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"id": str(r.id), "title": r.title, "body": r.body}


@router.delete("/canned/{canned_id}", status_code=204)
def delete_canned(
    canned_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    r = db.query(CannedReply).filter(CannedReply.id == canned_id).first()
    if r:
        db.delete(r)
        db.commit()
