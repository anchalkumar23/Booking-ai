import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from app.tasks.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.suppression import SuppressionList
from app.models.lead import Lead, LeadStatus
from app.models.lead_sequence_step import LeadSequenceStep, StepChannel, StepStatus
from app.models.whatsapp_message import WhatsAppMessage, WADirection, WAMessageType, WAStatus
from app.models.location import Location
from app.models.scheduled_message import ScheduledMessage, ScheduledMessageStatus
from app.integrations.whatsapp import (
    send_template_message,
    send_booking_confirmation,
    send_text_message,
    credentials_from_location,
)
from app.services.whatsapp_assistant import generate_reply

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")

# 4-step lead outreach templates (English only — must be pre-approved by Meta).
# These template names must match exactly what you submit for Meta approval.
LEAD_SEQUENCE_TEMPLATES = {
    1: "lead_intro_en",
    2: "lead_followup_en",
    3: "lead_offer_en",
    4: "lead_lastchance_en",
}

# Days between each step
STEP_DELAYS_DAYS = {1: 0, 2: 2, 3: 4, 4: 6}


def _is_suppressed(phone: str) -> bool:
    db = SessionLocal()
    try:
        return db.query(SuppressionList).filter(
            SuppressionList.phone == phone
        ).first() is not None
    finally:
        db.close()


def _save_outbound_message(db, phone: str, template_name: str, body: str, wa_message_id: str) -> None:
    db.add(WhatsAppMessage(
        wa_message_id=wa_message_id,
        phone=phone,
        direction=WADirection.outbound,
        message_type=WAMessageType.template,
        template_name=template_name,
        body=body,
        status=WAStatus.sent,
    ))
    db.commit()


@celery_app.task(name="app.tasks.whatsapp_tasks.send_booking_confirmation_task", bind=True, max_retries=3)
def send_booking_confirmation_task(
    self,
    phone: str,
    customer_name: str,
    service: str,
    scheduled_at: str,
    language: str,
    location_id: str | None = None,
):
    """Send booking confirmation WhatsApp message after appointment is booked."""
    if _is_suppressed(phone):
        logger.info(f"Skipping WA confirmation to suppressed number: {phone}")
        return {"status": "suppressed"}
    wa_pid, wa_token = None, None
    if location_id:
        db = SessionLocal()
        try:
            loc = db.query(Location).filter(Location.id == location_id).first()
            creds = credentials_from_location(loc)
            if creds:
                wa_pid, wa_token = creds.phone_number_id, creds.access_token
        finally:
            db.close()
    try:
        result = send_booking_confirmation(
            phone=phone,
            customer_name=customer_name,
            service=service,
            scheduled_at=scheduled_at,
            language=language,
            phone_number_id=wa_pid,
            access_token=wa_token,
        )
        logger.info(f"Booking confirmation sent to {phone}: {result}")
        return result
    except Exception as exc:
        logger.error(f"Booking confirmation failed for {phone}: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.tasks.whatsapp_tasks.send_lead_sequence_step", bind=True, max_retries=3)
def send_lead_sequence_step(self, lead_id: str, step_number: int):
    """Send one step of the 4-step lead WhatsApp sequence."""
    db = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            logger.warning(f"Lead {lead_id} not found")
            return

        # Check if sequence should be stopped
        if lead.wa_stopped or lead.status == LeadStatus.not_interested:
            logger.info(f"WA sequence stopped for lead {lead_id}")
            return

        if _is_suppressed(lead.phone):
            lead.wa_stopped = True
            db.commit()
            return

        # Find the sequence step record
        step = db.query(LeadSequenceStep).filter(
            LeadSequenceStep.lead_id == lead.id,
            LeadSequenceStep.step_number == step_number,
            LeadSequenceStep.channel == StepChannel.whatsapp,
        ).first()

        if not step or step.status != StepStatus.pending:
            return

        location = db.query(Location).filter(Location.id == lead.location_id).first()
        business_name = location.name if location else "our business"
        wa_pid, wa_token = None, None
        creds = credentials_from_location(location)
        if creds:
            wa_pid, wa_token = creds.phone_number_id, creds.access_token

        template_name = LEAD_SEQUENCE_TEMPLATES.get(step_number, "")

        if not template_name:
            logger.error(f"No template found for step {step_number}")
            return

        try:
            result = send_template_message(
                phone=lead.phone,
                template_name=template_name,
                language_code="en",
                components=[{
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": lead.full_name},
                        {"type": "text", "text": business_name},
                    ],
                }],
                phone_number_id=wa_pid,
                access_token=wa_token,
            )

            if result.get("status") in ("stub", "skipped"):
                reason = result.get("reason", result.get("status"))
                logger.info(f"WA step {step_number} skipped for lead {lead_id}: {reason}")
                # Surface the reason on the lead so it's visible in the dashboard
                if reason == "template_not_found":
                    lead.wa_last_error = f"Template '{template_name}' not approved in Meta yet"
                elif result.get("status") == "stub":
                    lead.wa_last_error = "WhatsApp not connected for this location"
                else:
                    lead.wa_last_error = f"WhatsApp step {step_number} skipped: {reason}"
                step.status = StepStatus.failed
                # Stop the whole sequence — later steps would fail identically and would
                # otherwise still be picked up by the DB poller. Fix the template/connection
                # then re-add the lead.
                lead.wa_stopped = True
                db.commit()
                return

            wa_message_id = result.get("messages", [{}])[0].get("id", f"stub_{lead_id}_{step_number}")
            _save_outbound_message(
                db, lead.phone, template_name,
                f"Step {step_number} for {lead.full_name}", wa_message_id
            )

            step.status = StepStatus.sent
            step.sent_at = datetime.now(timezone.utc)
            lead.wa_sequence_step = step_number
            lead.wa_last_error = None  # clear any previous error on success
            db.commit()
            # Steps 2-4 are already stored with their own scheduled_at and get sent by
            # dispatch_due_wa_steps when due — no long-lived Celery countdown needed.

        except Exception as exc:
            step.status = StepStatus.failed
            lead.wa_last_error = f"WhatsApp send failed (step {step_number})"
            db.commit()
            logger.error(f"WA step {step_number} failed for lead {lead_id}: {exc}")
            raise self.retry(exc=exc, countdown=120)

    finally:
        db.close()


@celery_app.task(name="app.tasks.whatsapp_tasks.start_lead_sequence")
def start_lead_sequence(lead_id: str):
    """Kick off the 4-step WhatsApp sequence for a new lead."""
    db = SessionLocal()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            return

        if _is_suppressed(lead.phone):
            lead.wa_stopped = True
            db.commit()
            return

        # Create all 4 step records upfront
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        for step_num in range(1, 5):
            delay_days = STEP_DELAYS_DAYS.get(step_num, 0)
            db.add(LeadSequenceStep(
                lead_id=lead.id,
                step_number=step_num,
                channel=StepChannel.whatsapp,
                status=StepStatus.pending,
                scheduled_at=now + timedelta(days=delay_days),
            ))
        db.commit()

        # Send step 1 immediately. Steps 2-4 are picked up by dispatch_due_wa_steps
        # once their scheduled_at is reached (see below) — no long Celery countdowns.
        send_lead_sequence_step.delay(lead_id=lead_id, step_number=1)
        logger.info(f"Lead WA sequence started for lead {lead_id}")

    finally:
        db.close()


@celery_app.task(name="app.tasks.whatsapp_tasks.dispatch_due_wa_steps")
def dispatch_due_wa_steps():
    """Runs every 5 minutes (celery beat). Sends any WhatsApp sequence steps whose
    scheduled_at has passed and are still pending. This replaces multi-day Celery
    countdown tasks, which Redis re-delivered hourly and which were lost on worker
    restarts. The step records live in the DB, so scheduling is durable."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        due = (
            db.query(LeadSequenceStep)
            .filter(
                LeadSequenceStep.channel == StepChannel.whatsapp,
                LeadSequenceStep.status == StepStatus.pending,
                LeadSequenceStep.scheduled_at <= now,
            )
            .order_by(LeadSequenceStep.scheduled_at)
            .limit(500)
            .all()
        )
        if not due:
            return {"dispatched": 0}
        for step in due:
            send_lead_sequence_step.delay(lead_id=str(step.lead_id), step_number=step.step_number)
        logger.info(f"dispatch_due_wa_steps queued {len(due)} due WhatsApp step(s)")
        return {"dispatched": len(due)}
    finally:
        db.close()


@celery_app.task(name="app.tasks.whatsapp_tasks.dispatch_due_messages")
def dispatch_due_messages():
    """Runs every minute (celery beat). Sends any queued WhatsApp broadcast messages
    whose due_at has passed. Rows live in the DB, so a broadcast survives worker
    restarts; each row is marked sent before dispatch so nobody is messaged twice."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        due = (
            db.query(ScheduledMessage)
            .filter(
                ScheduledMessage.status == ScheduledMessageStatus.pending,
                ScheduledMessage.due_at <= now,
            )
            .order_by(ScheduledMessage.due_at)
            .limit(500)
            .all()
        )
        if not due:
            return {"dispatched": 0}

        # Cache location credentials so we don't re-query per message.
        loc_cache: dict = {}

        def creds_for(location_id):
            if location_id not in loc_cache:
                loc = db.query(Location).filter(Location.id == location_id).first()
                loc_cache[location_id] = credentials_from_location(loc)
            return loc_cache[location_id]

        # Mark all sent first (single commit) so a crash can't double-send.
        for m in due:
            m.status = ScheduledMessageStatus.sent
            m.sent_at = now
        db.commit()

        sent = 0
        for m in due:
            if _is_suppressed(m.phone):
                continue
            creds = creds_for(m.location_id)
            wa_pid = creds.phone_number_id if creds else None
            wa_token = creds.access_token if creds else None
            components = []
            if m.params:
                components = [{
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(p)} for p in m.params],
                }]
            try:
                result = send_template_message(
                    phone=m.phone,
                    template_name=m.template,
                    language_code=m.language or "en",
                    components=components,
                    phone_number_id=wa_pid,
                    access_token=wa_token,
                )
                if result.get("status") in ("stub", "skipped"):
                    logger.info(f"Broadcast msg to {m.phone} skipped: {result.get('reason', result.get('status'))}")
                    continue
                wa_message_id = result.get("messages", [{}])[0].get("id", f"bcast_{m.id}")
                db.add(WhatsAppMessage(
                    wa_message_id=wa_message_id,
                    phone=m.phone,
                    direction=WADirection.outbound,
                    message_type=WAMessageType.template,
                    template_name=m.template,
                    body=f"Broadcast: {m.template}",
                    status=WAStatus.sent,
                ))
                db.commit()
                sent += 1
            except Exception as exc:
                logger.error(f"Broadcast msg to {m.phone} failed: {exc}")

        logger.info(f"dispatch_due_messages sent {sent}/{len(due)} broadcast message(s)")
        return {"dispatched": sent}
    finally:
        db.close()


@celery_app.task(name="app.tasks.whatsapp_tasks.generate_and_send_ai_reply", bind=True, max_retries=2)
def generate_and_send_ai_reply(self, phone: str, location_id: str):
    """Generate an LLM reply to an inbound WhatsApp message and send it as a free-form session message.

    Only valid within the 24h customer service window opened by the customer's own message —
    no Meta template is needed here. Outbound first-contact/reminder messages still go through
    send_template_message/send_booking_confirmation elsewhere.
    """
    if _is_suppressed(phone):
        logger.info(f"Skipping AI reply to suppressed number: {phone}")
        return {"status": "suppressed"}

    db = SessionLocal()
    try:
        location = db.query(Location).filter(Location.id == location_id).first()
        if not location:
            logger.warning(f"AI reply skipped — location {location_id} not found")
            return {"status": "no_location"}

        reply_text = generate_reply(db, phone, location)

        creds = credentials_from_location(location)
        wa_pid = creds.phone_number_id if creds else None
        wa_token = creds.access_token if creds else None

        result = send_text_message(phone=phone, text=reply_text, phone_number_id=wa_pid, access_token=wa_token)

        wa_message_id = result.get("messages", [{}])[0].get("id", f"stub_ai_{phone}_{int(datetime.now(timezone.utc).timestamp())}")
        db.add(WhatsAppMessage(
            wa_message_id=wa_message_id,
            phone=phone,
            direction=WADirection.outbound,
            message_type=WAMessageType.session,
            body=reply_text,
            status=WAStatus.sent,
        ))
        db.commit()
        return {"status": "replied", "wa_message_id": wa_message_id}
    except Exception as exc:
        logger.error(f"AI reply generation failed for {phone}: {exc}")
        raise self.retry(exc=exc, countdown=30)
    finally:
        db.close()
