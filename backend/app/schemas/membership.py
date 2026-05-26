from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import date, datetime
from app.models.membership import PaymentStatus


class MembershipCreate(BaseModel):
    customer_id: uuid.UUID
    location_id: uuid.UUID
    tier: str
    starts_at: date
    expires_at: date
    payment_status: PaymentStatus = PaymentStatus.pending


class MembershipUpdate(BaseModel):
    tier: Optional[str] = None
    starts_at: Optional[date] = None
    expires_at: Optional[date] = None
    payment_status: Optional[PaymentStatus] = None
    renewal_call_sent: Optional[bool] = None


class MembershipOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    location_id: uuid.UUID
    tier: str
    starts_at: date
    expires_at: date
    payment_status: PaymentStatus
    renewal_call_sent: bool
    created_at: datetime
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    location_name: Optional[str] = None
