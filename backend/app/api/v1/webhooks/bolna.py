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


def _detect_outcome(
    status: str,
    transcript: str,
    hangup_reason: str,
    confidence_score: float | None,
) -> CallOutcome:
    """Map Bolna execution status + transcript heuristics to our CallOutcome."""
    status = (status or "").lower()
    transcript_lower = (transcript or "").lower()
    hangup_reason = (hangup_reason or "").lower()

    # Check transcript for explicit signals first
    not_interested_phrases = [
        "not interested", "don't call", "remove me",
        "band karo", "nahin chahiye", "வேண்டாம்"
    ]
    if any(p in transcript_lower for p in not_interested_phrases):
        return CallOutcome.not_interested

    if confidence_score is not None and confidence_score < 0.70:
        return CallOutcome.low_confidence

    booked_phrases = ["booked", "confirmed", "see you", "appointment is set", "scheduled"]
    if any(p in transcript_lower for p in booked_phrases):
        return CallOutcome.booked

    if status in ("no-answer", "no_answer"):
        return CallOutcome.no_answer
    if status == "busy" or "busy" in hangup_reason:
        return CallOutcome.busy
    if status in ("failed", "cancelled", "error"):
        return CallOutcome.failed

    if status == "completed":
        # Call connected and finished but no clear booking signal in transcript
        if not transcript_lower.strip():
            return CallOutcome.no_answer
        return CallOutcome.booked

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


# Bolna sends webhooks for every status transition. We only persist/act on terminal states.
TERMINAL_STATUSES = {"completed", "busy", "no-answer", "no_answer", "failed", "cancelled", "error"}


@router.post("/call-outcome")
async def bolna_call_outcome(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("X-Bolna-Signature", "")

    if not _verify_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = await request.json()
    logger.info(f"Bolna webhook payload: {payload}")

    # Bolna's execution schema: top-level "id", "status", "transcript",
    # "conversation_duration", "telephony_data": {to_number, recording_url, duration, hangup_reason}
    call_id = payload.get("id") or payload.get("call_id", "")
    status = (payload.get("status") or "").lower()
    telephony = payload.get("telephony_data") or {}
    phone = (
        telephony.get("to_number")
        or payload.get("to_number")
        or payload.get("recipient_phone_number", "")
    )
    agent_id = payload.get("agent_id", "")
    transcript = payload.get("transcript") or ""
    recording_url = telephony.get("recording_url") or payload.get("recording_url", "")
    duration_secs = int(
        payload.get("conversation_duration")
        or telephony.get("duration")
        or 0
    )
    extracted_data = payload.get("extracted_data") or {}
    context_details = payload.get("context_details") or {}
    user_data = {**context_details, **payload.get("user_data", {})}
    summary = extracted_data.get("summary") or extracted_data.get("call_summary")
    confidence_score = extracted_data.get("confidence_score")
    hangup_reason = telephony.get("hangup_reason", "")

    if not call_id:
        logger.warning("Bolna webhook missing call id, ignoring")
        return {"status": "ignored", "reason": "no_call_id"}

    if status not in TERMINAL_STATUSES:
        logger.info(f"Bolna webhook for {call_id}: non-terminal status '{status}', skipping")
        return {"status": "ignored", "reason": "not_terminal"}

    outcome = _detect_outcome(status, transcript, hangup_reason, confidence_score)

    # Determine purpose from agent_id
    purpose_map = {
        settings.bolna_reminder_agent_id: CallPurpose.reminder,
        settings.bolna_renewal_agent_id: CallPurpose.renewal,
        settings.bolna_lead_agent_id: CallPurpose.lead,
    }
    purpose = purpose_map.get(agent_id, CallPurpose.reminder)

    # Upsert — first webhook for a call may arrive before the final terminal one
    call_log = db.query(CallLog).filter(CallLog.bolna_call_id == call_id).first()
    if call_log and call_log.outcome is not None:
        return {"status": "already_processed"}

    if call_log:
        call_log.outcome = outcome
        call_log.transcript = transcript
        call_log.summary = summary
        call_log.recording_url = recording_url
        call_log.duration_secs = duration_secs
        call_log.confidence_score = confidence_score
    else:
        call_log = CallLog(
            bolna_call_id=call_id,
            phone=phone,
            direction=CallDirection.outbound,
            purpose=purpose,
            outcome=outcome,
            confidence_score=confidence_score,
            duration_secs=duration_secs,
            transcript=transcript,
            summary=summary,
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
