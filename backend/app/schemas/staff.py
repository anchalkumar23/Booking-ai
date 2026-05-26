from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
from datetime import datetime


class WorkingDayHours(BaseModel):
    start: str
    end: str


class StaffCreate(BaseModel):
    location_id: uuid.UUID
    full_name: str
    phone: Optional[str] = None
    working_hours: Dict[str, Optional[WorkingDayHours]]


class StaffUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    working_hours: Optional[Dict[str, Optional[WorkingDayHours]]] = None
    is_active: Optional[bool] = None


class StaffOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    location_id: uuid.UUID
    full_name: str
    phone: Optional[str]
    working_hours: Dict[str, Any]
    is_active: bool
    created_at: datetime
