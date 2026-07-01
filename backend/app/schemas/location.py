from pydantic import BaseModel, Field
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
    password: str = Field(min_length=4, max_length=128)
    knowledge_base: Optional[str] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[LocationType] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=4, max_length=128)
    knowledge_base: Optional[str] = None


class LocationOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    name: str
    type: LocationType
    city: str
    phone: str
    timezone: str
    is_active: bool
    has_password: bool = False
    knowledge_base: Optional[str] = None
    whatsapp_connected: bool = False
    whatsapp_display_phone: Optional[str] = None
    created_at: datetime


class LocationSelectRequest(BaseModel):
    location_id: uuid.UUID
    password: str


class WhatsAppConnectRequest(BaseModel):
    phone_number_id: str
    waba_id: str
    access_token: str
    display_phone: Optional[str] = None


class WhatsAppStatusOut(BaseModel):
    connected: bool
    display_phone: Optional[str] = None
    phone_number_id: Optional[str] = None
    waba_id: Optional[str] = None
