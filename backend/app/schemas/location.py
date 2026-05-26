from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime
from app.models.location import LocationType


class LocationCreate(BaseModel):
    name: str
    type: LocationType
    city: str
    phone: str
    timezone: str = "Asia/Kolkata"


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[LocationType] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None


class LocationOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    name: str
    type: LocationType
    city: str
    phone: str
    timezone: str
    is_active: bool
    created_at: datetime
