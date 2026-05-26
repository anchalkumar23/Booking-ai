from pydantic import BaseModel
from typing import Optional
import uuid


class CallStats(BaseModel):
    initiated: int
    connected: int
    completed: int
    converted: int
    no_answer: int
    not_interested: int
    low_confidence: int
    avg_duration_secs: float


class WhatsAppStats(BaseModel):
    sent: int
    delivered: int
    read: int
    replied: int
    failed: int
    delivery_rate: float
    read_rate: float
    reply_rate: float


class AppointmentStats(BaseModel):
    total: int
    scheduled: int
    completed: int
    cancelled: int
    no_show: int
    completion_rate: float
    no_show_rate: float
    reminders_sent: int


class LeadStats(BaseModel):
    total: int
    new: int
    contacted: int
    interested: int
    converted: int
    not_interested: int
    conversion_rate: float


class OverviewStats(BaseModel):
    calls: CallStats
    whatsapp: WhatsAppStats
    appointments: AppointmentStats
    leads: LeadStats
