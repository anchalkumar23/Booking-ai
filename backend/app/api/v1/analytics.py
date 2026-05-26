from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.call_log import CallLog, CallOutcome
from app.models.whatsapp_message import WhatsAppMessage, WADirection, WAStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.models.lead import Lead, LeadStatus
from app.schemas.analytics import (
    CallStats, WhatsAppStats, AppointmentStats, LeadStats, OverviewStats
)

router = APIRouter(prefix="/analytics", tags=["analytics"])
IST = ZoneInfo("Asia/Kolkata")


def _date_filter(query, model, date_col, start: Optional[datetime], end: Optional[datetime]):
    if start:
        query = query.filter(date_col >= start)
    if end:
        query = query.filter(date_col <= end)
    return query


def _get_call_stats(db: Session, location_id: Optional[uuid.UUID], start: Optional[datetime], end: Optional[datetime]) -> CallStats:
    q = db.query(CallLog)
    q = _date_filter(q, CallLog, CallLog.called_at, start, end)

    all_calls = q.all()
    total = len(all_calls)

    outcome_counts = {o.value: 0 for o in CallOutcome}
    durations = []
    for c in all_calls:
        if c.outcome:
            outcome_counts[c.outcome.value] = outcome_counts.get(c.outcome.value, 0) + 1
        if c.duration_secs:
            durations.append(c.duration_secs)

    connected = total - outcome_counts.get("no_answer", 0) - outcome_counts.get("failed", 0)
    completed = connected - outcome_counts.get("low_confidence", 0) - outcome_counts.get("transferred", 0)
    converted = outcome_counts.get("booked", 0) + outcome_counts.get("rescheduled", 0)
    avg_duration = sum(durations) / len(durations) if durations else 0.0

    return CallStats(
        initiated=total,
        connected=max(connected, 0),
        completed=max(completed, 0),
        converted=converted,
        no_answer=outcome_counts.get("no_answer", 0),
        not_interested=outcome_counts.get("not_interested", 0),
        low_confidence=outcome_counts.get("low_confidence", 0),
        avg_duration_secs=round(avg_duration, 1),
    )


def _get_whatsapp_stats(db: Session, location_id: Optional[uuid.UUID], start: Optional[datetime], end: Optional[datetime]) -> WhatsAppStats:
    q = db.query(WhatsAppMessage).filter(WhatsAppMessage.direction == WADirection.outbound)
    q = _date_filter(q, WhatsAppMessage, WhatsAppMessage.sent_at, start, end)
    messages = q.all()

    total = len(messages)
    delivered = sum(1 for m in messages if m.status in (WAStatus.delivered, WAStatus.read, WAStatus.replied))
    read = sum(1 for m in messages if m.status in (WAStatus.read, WAStatus.replied))
    replied = sum(1 for m in messages if m.status == WAStatus.replied)
    failed = sum(1 for m in messages if m.status == WAStatus.failed)

    delivery_rate = round(delivered / total * 100, 1) if total else 0.0
    read_rate = round(read / total * 100, 1) if total else 0.0
    reply_rate = round(replied / total * 100, 1) if total else 0.0

    return WhatsAppStats(
        sent=total,
        delivered=delivered,
        read=read,
        replied=replied,
        failed=failed,
        delivery_rate=delivery_rate,
        read_rate=read_rate,
        reply_rate=reply_rate,
    )


def _get_appointment_stats(db: Session, location_id: Optional[uuid.UUID], start: Optional[datetime], end: Optional[datetime]) -> AppointmentStats:
    q = db.query(Appointment)
    if location_id:
        q = q.filter(Appointment.location_id == location_id)
    q = _date_filter(q, Appointment, Appointment.scheduled_at, start, end)
    appointments = q.all()

    total = len(appointments)
    scheduled = sum(1 for a in appointments if a.status == AppointmentStatus.scheduled)
    completed = sum(1 for a in appointments if a.status == AppointmentStatus.completed)
    cancelled = sum(1 for a in appointments if a.status == AppointmentStatus.cancelled)
    no_show = sum(1 for a in appointments if a.status == AppointmentStatus.no_show)
    reminders_sent = sum(1 for a in appointments if a.reminder_sent)

    finished = completed + no_show
    completion_rate = round(completed / finished * 100, 1) if finished else 0.0
    no_show_rate = round(no_show / finished * 100, 1) if finished else 0.0

    return AppointmentStats(
        total=total,
        scheduled=scheduled,
        completed=completed,
        cancelled=cancelled,
        no_show=no_show,
        completion_rate=completion_rate,
        no_show_rate=no_show_rate,
        reminders_sent=reminders_sent,
    )


def _get_lead_stats(db: Session, location_id: Optional[uuid.UUID], start: Optional[datetime], end: Optional[datetime]) -> LeadStats:
    q = db.query(Lead)
    if location_id:
        q = q.filter(Lead.location_id == location_id)
    q = _date_filter(q, Lead, Lead.created_at, start, end)
    leads = q.all()

    total = len(leads)
    status_counts = {s.value: 0 for s in LeadStatus}
    for l in leads:
        status_counts[l.status.value] = status_counts.get(l.status.value, 0) + 1

    converted = status_counts.get("converted", 0)
    conversion_rate = round(converted / total * 100, 1) if total else 0.0

    return LeadStats(
        total=total,
        new=status_counts.get("new", 0),
        contacted=status_counts.get("contacted", 0),
        interested=status_counts.get("interested", 0),
        converted=converted,
        not_interested=status_counts.get("not_interested", 0),
        conversion_rate=conversion_rate,
    )


@router.get("/overview", response_model=OverviewStats)
def get_overview(
    location_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    return OverviewStats(
        calls=_get_call_stats(db, location_id, start_date, end_date),
        whatsapp=_get_whatsapp_stats(db, location_id, start_date, end_date),
        appointments=_get_appointment_stats(db, location_id, start_date, end_date),
        leads=_get_lead_stats(db, location_id, start_date, end_date),
    )


@router.get("/calls", response_model=CallStats)
def get_call_stats(
    location_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    return _get_call_stats(db, location_id, start_date, end_date)


@router.get("/whatsapp", response_model=WhatsAppStats)
def get_whatsapp_stats(
    location_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    return _get_whatsapp_stats(db, location_id, start_date, end_date)


@router.get("/appointments", response_model=AppointmentStats)
def get_appointment_stats(
    location_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    return _get_appointment_stats(db, location_id, start_date, end_date)


@router.get("/leads", response_model=LeadStats)
def get_lead_stats(
    location_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    return _get_lead_stats(db, location_id, start_date, end_date)
