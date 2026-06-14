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
from app.integrations.whatsapp import (
    send_template_message,
    send_booking_confirmation,
    language_from_code,
)

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")

# 4-step lead outreach templates (must be pre-approved by Meta)
# These template names must match exactly what you submit for Meta approval
LEAD_SEQUENCE_TEMPLATES = {
    1: {"en": "lead_intro_en", "hi": "lead_intro_hi", "ta": "lead_intro_ta"},
    2: {"en": "lead_followup_en", "hi": "lead_followup_hi", "ta": "lead_followup_ta"},
    3: {"en": "lead_offer_en", "hi": "lead_offer_hi", "ta": "lead_offer_ta"},
    4: {"en": "lead_lastchance_en", "hi": "lead_lastchance_hi", "ta": "lead_lastchance_ta"},
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
):
    """Send booking confirmation WhatsApp message after appointment is booked."""
    if _is_suppressed(phone):
        logger.info(f"Skipping WA confirmation to suppressed number: {phone}")
        return {"status": "suppressed"}
    try:
        result = send_booking_confirmation(
            phone=phone,
            customer_name=customer_name,
            service=service,
            scheduled_at=scheduled_at,
            language=language,
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

        lang = lead.language.value
        templates = LEAD_SEQUENCE_TEMPLATES.get(step_number, {})
        template_name = templates.get(lang, templates.get("en", ""))

        if not template_name:
            logger.error(f"No template found for step {step_number}, language {lang}")
            return

        try:
            result = send_template_message(
                phone=lead.phone,
                template_name=template_name,
                language_code=language_from_code(lang),
                components=[{
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": lead.full_name},
                        {"type": "text", "text": business_name},
                    ],
                }],
            )

            if result.get("status") in ("stub", "skipped"):
                logger.info(f"WA step {step_number} skipped for lead {lead_id}: {result.get('reason', result.get('status'))}")
                step.status = StepStatus.sent  # mark as sent so sequence continues
                step.sent_at = datetime.now(timezone.utc)
                db.commit()
                if step_number < 4:
                    delay_days = STEP_DELAYS_DAYS.get(step_number + 1, 2)
                    send_lead_sequence_step.apply_async(
                        kwargs={"lead_id": lead_id, "step_number": step_number + 1},
                        countdown=delay_days * 86400,
                    )
                return

            wa_message_id = result.get("messages", [{}])[0].get("id", f"stub_{lead_id}_{step_number}")
            _save_outbound_message(
                db, lead.phone, template_name,
                f"Step {step_number} for {lead.full_name}", wa_message_id
            )

            step.status = StepStatus.sent
            step.sent_at = datetime.now(timezone.utc)
            lead.wa_sequence_step = step_number
            db.commit()

            # Schedule next step if not the last
            if step_number < 4:
                delay_days = STEP_DELAYS_DAYS.get(step_number + 1, 2)
                send_lead_sequence_step.apply_async(
                    kwargs={"lead_id": lead_id, "step_number": step_number + 1},
                    countdown=delay_days * 86400,
                )
                logger.info(f"Next WA step {step_number + 1} scheduled in {delay_days} days for lead {lead_id}")

        except Exception as exc:
            step.status = StepStatus.failed
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

        # Send step 1 immediately
        send_lead_sequence_step.delay(lead_id=lead_id, step_number=1)
        logger.info(f"Lead WA sequence started for lead {lead_id}")

    finally:
        db.close()
