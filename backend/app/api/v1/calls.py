from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.call_log import CallLog, CallPurpose, CallOutcome

router = APIRouter(prefix="/calls", tags=["calls"])


@router.get("")
def list_calls(
    purpose: Optional[CallPurpose] = None,
    outcome: Optional[CallOutcome] = None,
    phone: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    q = db.query(CallLog)
    if purpose:
        q = q.filter(CallLog.purpose == purpose)
    if outcome:
        q = q.filter(CallLog.outcome == outcome)
    if phone:
        q = q.filter(CallLog.phone.ilike(f"%{phone}%"))
    total = q.count()
    calls = q.order_by(CallLog.called_at.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "calls": [
            {
                "id": str(c.id),
                "bolna_call_id": c.bolna_call_id,
                "phone": c.phone,
                "direction": c.direction.value,
                "purpose": c.purpose.value,
                "outcome": c.outcome.value,
                "confidence_score": c.confidence_score,
                "duration_secs": c.duration_secs,
                "transcript": c.transcript,
                "recording_url": c.recording_url,
                "retry_count": c.retry_count,
                "called_at": c.called_at.isoformat() if c.called_at else None,
            }
            for c in calls
        ],
    }
