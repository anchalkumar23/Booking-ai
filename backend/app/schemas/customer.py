from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid
from datetime import datetime
from app.models.customer import Language


class CustomerCreate(BaseModel):
    location_id: uuid.UUID
    full_name: str
    phone: str
    email: Optional[EmailStr] = None
    language: Language = Language.en


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    language: Optional[Language] = None
    is_dnd: Optional[bool] = None
    is_suppressed: Optional[bool] = None


class CustomerOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    location_id: uuid.UUID
    full_name: str
    phone: str
    email: Optional[str]
    language: Language
    is_dnd: bool
    is_suppressed: bool
    created_at: datetime
