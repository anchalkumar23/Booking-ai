import hmac
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.models.call_log import CallLog, CallDirection, CallPurpose, CallOutcome
from app.models.customer import Customer
from app.models.suppression import SuppressionList, SuppressionReason, SuppressionSource
from app.models.appointment import Appointment, AppointmentStatus
from app.models.lead import Lead, LeadStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks/bolna", tags=["webhooks"])

# Map Bolna status strings → our CallOutcome enum
OUTCOME_MAP = {
    "call_completed": CallOutcome.booked,
    "user_busy": CallOutcome.busy,
    "no_answer": CallOutcome.no_answer,
    "call_failed": CallOutcome.failed,
    "low_confidence": CallOutcome.low_confidence,
    "not_interested": CallOutcome.not_interested,
    "transferred": CallOutcome.transferred,
}


def _verify_signature(body: bytes, signature: str) -> bool:
    """Verify Bolna webhook HMAC signature."""
    if not settings.bolna_webhook_secret:
        return True  # skip verification in dev if secret not set
    expected = hmac.new(
        settings.bolna_webhook_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def _detect_outcome(payload: dict) -> CallOutcome:
    """Map Bolna webhook payload to our CallOutcome."""
    status = payload.get("status", "").lower()
    transcript = payload.get("transcript", "").lower()

    # Check transcript for explicit signals
    not_interested_phrases = [
        "not interested", "don't call", "remove me",
        "band karo", "nahin chahiye", "வேண்டாம்"
    ]
    if any(p in transcript for p in not_interested_phrases):
        return CallOutcome.not_interested

    if payload.get("confidence_score", 1.0) < 0.70:
        return CallOutcome.low_confidence

    return OUTCOME_MAP.get(status, CallOutcome.failed)


def _suppress_contact(db: Session, phone: str, source: SuppressionSource) -> None:
    """Add phone to global suppression list and mark customer."""
    existing = db.query(SuppressionList).filter(SuppressionList.phone == phone).first()
    if not existing:
        db.add(SuppressionList(
            phone=phone,
            reason=SuppressionReason.not_interested,
            source=source,
        ))
    # Also update customer flag for fast lookup
    customer = db.query(Customer).filter(Customer.phone == phone).first()
    if customer:
        customer.is_suppressed = True
    db.commit()


@router.post("/call-outcome")
async def bolna_call_outcome(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("X-Bolna-Signature", "")

    if not _verify_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = await request.json()
    logger.info(f"Bolna webhook received: {payload.get('call_id')}")

    call_id = payload.get("call_id") or payload.get("id", "")
    phone = payload.get("to_number") or payload.get("recipient_phone_number", "")
    agent_id = payload.get("agent_id", "")
    transcript = payload.get("transcript", "")
    recording_url = payload.get("recording_url", "")
    duration_secs = payload.get("duration", 0)
    confidence_score = payload.get("confidence_score", 1.0)
    user_data = payload.get("user_data", {})

    # Idempotency — skip if already processed
    existing = db.query(CallLog).filter(CallLog.bolna_call_id == call_id).first()
    if existing:
        return {"status": "already_processed"}

    # Detect outcome
    outcome = _detect_outcome(payload)

    # Determine purpose from agent_id
    purpose_map = {
        settings.bolna_reminder_agent_id: CallPurpose.reminder,
        settings.bolna_renewal_agent_id: CallPurpose.renewal,
        settings.bolna_lead_agent_id: CallPurpose.lead,
    }
    purpose = purpose_map.get(agent_id, CallPurpose.reminder)

    # Save call log
    call_log = CallLog(
        bolna_call_id=call_id,
        phone=phone,
        direction=CallDirection.outbound,
        purpose=purpose,
        outcome=outcome,
        confidence_score=confidence_score,
        duration_secs=duration_secs,
        transcript=transcript,
        recording_url=recording_url,
        retry_count=int(user_data.get("retry_count", 0)),
        called_at=datetime.now(timezone.utc),
    )
    db.add(call_log)
    db.commit()

    # Handle outcome side effects
    _handle_outcome(db, outcome, phone, purpose, user_data, call_id)

    return {"status": "ok"}


def _handle_outcome(
    db: Session,
    outcome: CallOutcome,
    phone: str,
    purpose: CallPurpose,
    user_data: dict,
    call_id: str,
) -> None:
    from app.tasks.bolna_tasks import retry_call_task

    if outcome == CallOutcome.not_interested:
        _suppress_contact(db, phone, SuppressionSource.call)
        # Stop lead outreach if applicable
        lead = db.query(Lead).filter(Lead.phone == phone).first()
        if lead:
            lead.call_stopped = True
            lead.status = LeadStatus.not_interested
            db.commit()

    elif outcome in (CallOutcome.no_answer, CallOutcome.failed):
        retry_count = int(user_data.get("retry_count", 0))
        if retry_count < 2:  # max 2 auto-retries
            retry_call_task.apply_async(
                kwargs={
                    "phone": phone,
                    "purpose": purpose.value,
                    "user_data": {**user_data, "retry_count": retry_count + 1},
                },
                countdown=300,  # retry in 5 minutes
            )

    elif outcome == CallOutcome.busy:
        retry_count = int(user_data.get("retry_count", 0))
        if retry_count < 1:
            retry_call_task.apply_async(
                kwargs={
                    "phone": phone,
                    "purpose": purpose.value,
                    "user_data": {**user_data, "retry_count": retry_count + 1},
                },
                countdown=1800,  # retry in 30 minutes
            )

    elif outcome == CallOutcome.booked:
        # Mark appointment as confirmed if reminder call
        appointment_id = user_data.get("appointment_id")
        if appointment_id:
            appt = db.query(Appointment).filter(
                Appointment.id == appointment_id
            ).first()
            if appt:
                appt.reminder_sent = True
                db.commit()

    elif outcome in (CallOutcome.transferred, CallOutcome.low_confidence):
        # Bolna handles the transfer; we just log it
        logger.info(f"Call {call_id} transferred to human — phone: {phone}")
