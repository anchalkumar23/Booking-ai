from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime
from app.models.appointment import AppointmentStatus, BookedVia


class SlotOut(BaseModel):
    time: datetime
    available_staff_count: int


class AppointmentCreate(BaseModel):
    customer_id: uuid.UUID
    location_id: uuid.UUID
    service: str
    scheduled_at: datetime
    duration_mins: int = 60
    booked_via: BookedVia = BookedVia.dashboard


class AppointmentUpdate(BaseModel):
    service: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_mins: Optional[int] = None
    status: Optional[AppointmentStatus] = None


class AppointmentOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    customer_id: uuid.UUID
    location_id: uuid.UUID
    staff_id: Optional[uuid.UUID]
    service: str
    scheduled_at: datetime
    duration_mins: int
    status: AppointmentStatus
    gcal_event_id: Optional[str]
    booked_via: BookedVia
    reminder_sent: bool
    created_at: datetime
