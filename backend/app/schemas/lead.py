from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime, date
from app.models.lead import LeadStatus
from app.models.customer import Language


class LeadCreate(BaseModel):
    location_id: uuid.UUID
    full_name: str
    phone: str
    language: Language = Language.en
    source: str = "manual"
    follow_up_date: Optional[date] = None


class LeadImportRow(BaseModel):
    full_name: str
    phone: str
    language: str = "en"
    source: str = "csv_import"


class LeadUpdate(BaseModel):
    status: Optional[LeadStatus] = None
    wa_stopped: Optional[bool] = None
    call_stopped: Optional[bool] = None
    follow_up_date: Optional[date] = None


class LeadOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    location_id: uuid.UUID
    full_name: str
    phone: str
    language: Language
    source: str
    status: LeadStatus
    wa_sequence_step: int
    wa_stopped: bool
    call_stopped: bool
    follow_up_date: Optional[date] = None
    created_at: datetime
