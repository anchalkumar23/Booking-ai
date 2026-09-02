import logging
from fastapi import APIRouter, Request, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.integrations.whatsapp import is_opt_out
from app.models.whatsapp_message import WhatsAppMessage, WADirection, WAMessageType, WAStatus
from app.models.customer import Customer
from app.models.lead import Lead, LeadStatus
from app.models.location import Location
from app.models.suppression import SuppressionList, SuppressionReason, SuppressionSource
from app.models.inbox_extras import ConversationState
from app.tasks.whatsapp_tasks import generate_and_send_ai_reply

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks/whatsapp", tags=["webhooks"])


def _suppress_contact(db: Session, phone: str) -> None:
    existing = db.query(SuppressionList).filter(SuppressionList.phone == phone).first()
    if not existing:
        db.add(SuppressionList(
            phone=phone,
            reason=SuppressionReason.opt_out,
            source=SuppressionSource.whatsapp,
        ))
    customer = db.query(Customer).filter(Customer.phone == phone).first()
    if customer:
        customer.is_suppressed = True
    db.commit()


def _ai_enabled_for(db: Session, phone: str) -> bool:
    state = db.query(ConversationState).filter(ConversationState.phone == phone).first()
    return state.ai_enabled if state else True


def _resolve_location(db: Session, value: dict) -> Location | None:
    """Identify which business location this webhook event belongs to (multi-location SaaS)."""
    phone_number_id = value.get("metadata", {}).get("phone_number_id")
    if phone_number_id:
        location = db.query(Location).filter(Location.whatsapp_phone_number_id == phone_number_id).first()
        if location:
            return location
    if settings.default_location_id:
        return db.query(Location).filter(Location.id == settings.default_location_id).first()
    return None


def _save_inbound_message(db: Session, phone: str, text: str, wa_message_id: str) -> None:
    existing = db.query(WhatsAppMessage).filter(
        WhatsAppMessage.wa_message_id == wa_message_id
    ).first()
    if existing:
        return  # idempotent
    db.add(WhatsAppMessage(
        wa_message_id=wa_message_id,
        phone=phone,
        direction=WADirection.inbound,
        message_type=WAMessageType.session,
        body=text,
        status=WAStatus.replied,
    ))
    db.commit()


@router.get("/verify")
def verify_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_challenge: str = Query(alias="hub.challenge"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
):
    """Meta webhook verification handshake."""
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/verify")
async def receive_message(request: Request, db: Session = Depends(get_db)):
    """Receive incoming WhatsApp messages from Meta."""
    payload = await request.json()

    try:
        entry = payload["entry"][0]
        changes = entry["changes"][0]
        value = changes["value"]

        # Handle status updates (delivered, read, failed, etc.)
        if "statuses" in value:
            logger.info(f"WhatsApp status webhook: {value['statuses']}")
            _handle_status_updates(db, value["statuses"])
            return {"status": "ok"}

        location = _resolve_location(db, value)

        messages = value.get("messages", [])
        for msg in messages:
            phone = msg["from"]
            wa_message_id = msg["id"]
            msg_type = msg.get("type", "text")
            text = ""

            if msg_type == "text":
                text = msg["text"]["body"]
            elif msg_type == "button":
                text = msg["button"]["text"]
            elif msg_type == "interactive":
                text = msg["interactive"].get("button_reply", {}).get("title", "")

            _save_inbound_message(db, phone, text, wa_message_id)

            if is_opt_out(text):
                _suppress_contact(db, phone)
                logger.info(f"Opt-out detected from {phone}: {text}")
                continue

            # Cross-channel sync: customer replied on WA → stop outbound calls
            _stop_calls_for_phone(db, phone)

            # Stop lead WA sequence if they replied
            _handle_lead_reply(db, phone)

            # Let the AI assistant answer free-form within the 24h customer service window —
            # no template needed since the customer messaged us first. Skipped if a staff
            # member has paused AI for this conversation (Inbox -> Pause AI).
            if location and text and _ai_enabled_for(db, phone):
                generate_and_send_ai_reply.delay(phone=phone, location_id=str(location.id))

    except (KeyError, IndexError) as e:
        logger.warning(f"WhatsApp webhook parse error: {e} — payload: {payload}")

    return {"status": "ok"}


def _handle_status_updates(db: Session, statuses: list) -> None:
    for status in statuses:
        wa_id = status.get("id")
        new_status = status.get("status")
        recipient = status.get("recipient_id")

        # When Meta drops a message it explains why in `errors` — surface it loudly.
        if new_status == "failed":
            errors = status.get("errors", [])
            for err in errors:
                logger.error(
                    f"WhatsApp DELIVERY FAILED to {recipient} (msg {wa_id}): "
                    f"code={err.get('code')} title={err.get('title')} "
                    f"details={err.get('error_data', {}).get('details') or err.get('message')}"
                )
            if not errors:
                logger.error(f"WhatsApp DELIVERY FAILED to {recipient} (msg {wa_id}): no error detail provided")

        status_map = {
            "sent": WAStatus.sent,
            "delivered": WAStatus.delivered,
            "read": WAStatus.read,
            "failed": WAStatus.failed,
        }
        if wa_id and new_status in status_map:
            msg = db.query(WhatsAppMessage).filter(
                WhatsAppMessage.wa_message_id == wa_id
            ).first()
            if msg:
                msg.status = status_map[new_status]
                db.commit()


def _stop_calls_for_phone(db: Session, phone: str) -> None:
    """If customer replies on WhatsApp, stop all outbound calls to them."""
    lead = db.query(Lead).filter(Lead.phone == phone).first()
    if lead:
        lead.call_stopped = True
        db.commit()


def _handle_lead_reply(db: Session, phone: str) -> None:
    """Mark lead as contacted when they reply."""
    lead = db.query(Lead).filter(
        Lead.phone == phone,
        Lead.status == LeadStatus.new,
    ).first()
    if lead:
        lead.status = LeadStatus.contacted
        lead.wa_stopped = True
        db.commit()
