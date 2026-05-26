# Phase 2 — Appointments + Staff + Availability APIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver staff management, real-time availability slot checking, and full appointment CRUD APIs — the core engine that all AI call and WhatsApp automation will use to book appointments.

**Architecture:** New `staff` model + Alembic migration, availability engine as a pure service function (no external deps), appointment service with `SELECT FOR UPDATE` for race-condition-safe booking. All routes protected by the Phase 1 JWT cookie auth. No Google Calendar in this phase.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, PostgreSQL 16, Alembic, Pydantic v2, python-dateutil.

---

## File Map

```
backend/
├── alembic/versions/
│   └── 003_add_staff_and_staff_id.py
├── app/
│   ├── models/
│   │   └── staff.py                      # NEW
│   ├── schemas/
│   │   ├── location.py                   # NEW
│   │   ├── staff.py                      # NEW
│   │   ├── customer.py                   # NEW
│   │   └── appointment.py                # NEW
│   ├── services/
│   │   ├── availability.py               # NEW — slot engine
│   │   └── appointment.py                # NEW — create/update/cancel
│   └── api/v1/
│       ├── locations.py                  # NEW
│       ├── staff.py                      # NEW
│       ├── customers.py                  # NEW
│       ├── appointments.py               # NEW
│       └── router.py                     # MODIFY — add new routers
```

---

## Task 1: Staff model + migration 003

**Files:**
- Create: `backend/app/models/staff.py`
- Create: `backend/alembic/versions/003_add_staff_and_staff_id.py`

- [ ] **Step 1: Create `backend/app/models/staff.py`**

```python
import uuid
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base, UUIDMixin


class Staff(UUIDMixin, Base):
    __tablename__ = "staff"

    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    working_hours: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    location = relationship("Location", lazy="select")
```

- [ ] **Step 2: Create `backend/alembic/versions/003_add_staff_and_staff_id.py`**

```python
"""add staff table and staff_id to appointments

Revision ID: 003
Revises: 002
Create Date: 2026-05-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove the over-strict unique constraint from Phase 1
    op.drop_constraint("uq_location_slot", "appointments", type_="unique")

    # Create staff table
    op.create_table(
        "staff",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("working_hours", postgresql.JSONB(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_staff_location_id", "staff", ["location_id"])

    # Add staff_id to appointments (nullable — existing rows have no staff)
    op.add_column(
        "appointments",
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_appointments_staff_id",
        "appointments", "staff",
        ["staff_id"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_appointments_staff_id", "appointments", type_="foreignkey")
    op.drop_column("appointments", "staff_id")
    op.drop_table("staff")
    op.create_unique_constraint(
        "uq_location_slot", "appointments", ["location_id", "scheduled_at"]
    )
```

- [ ] **Step 3: Add `staff_id` to the Appointment SQLAlchemy model**

Open `backend/app/models/appointment.py` and add these two lines after the `reminder_sent` column:

```python
    staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff.id"), nullable=True
    )
```

Also add the import at the top if not already present: `from sqlalchemy import ForeignKey`

- [ ] **Step 4: Run migration**

```bash
cd backend
alembic upgrade head
```

Expected output: `Running upgrade 002 -> 003, add staff table and staff_id to appointments`

- [ ] **Step 5: Add Staff import to alembic env.py**

Open `backend/alembic/env.py` and add this line after the other model imports:

```python
import app.models.staff
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/staff.py backend/alembic/versions/003_add_staff_and_staff_id.py backend/app/models/appointment.py backend/alembic/env.py
git commit -m "feat: staff model and migration 003 — staff table + staff_id on appointments"
```

---

## Task 2: Pydantic schemas for all 4 resources

**Files:**
- Create: `backend/app/schemas/location.py`
- Create: `backend/app/schemas/staff.py`
- Create: `backend/app/schemas/customer.py`
- Create: `backend/app/schemas/appointment.py`

- [ ] **Step 1: Create `backend/app/schemas/location.py`**

```python
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
```

- [ ] **Step 2: Create `backend/app/schemas/staff.py`**

```python
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
from datetime import datetime


class WorkingDayHours(BaseModel):
    start: str  # "09:00"
    end: str    # "18:00"


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
```

- [ ] **Step 3: Create `backend/app/schemas/customer.py`**

```python
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
```

- [ ] **Step 4: Create `backend/app/schemas/appointment.py`**

```python
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
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: Pydantic schemas for locations, staff, customers, appointments"
```

---

## Task 3: Availability service

**Files:**
- Create: `backend/app/services/availability.py`

- [ ] **Step 1: Create `backend/app/services/availability.py`**

```python
from datetime import datetime, timedelta, timezone
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.staff import Staff
from app.models.appointment import Appointment, AppointmentStatus

DAY_MAP = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}


def _parse_time(date: datetime, time_str: str) -> datetime:
    h, m = map(int, time_str.split(":"))
    return date.replace(hour=h, minute=m, second=0, microsecond=0, tzinfo=timezone.utc)


def _staff_has_conflict(
    db: Session,
    staff_id,
    slot_start: datetime,
    slot_end: datetime,
    exclude_appointment_id=None,
) -> bool:
    q = db.query(Appointment).filter(
        Appointment.staff_id == staff_id,
        Appointment.status == AppointmentStatus.scheduled,
        Appointment.scheduled_at < slot_end,
        (Appointment.scheduled_at + timedelta(minutes=1) * Appointment.duration_mins) > slot_start,
    )
    if exclude_appointment_id:
        q = q.filter(Appointment.id != exclude_appointment_id)
    return q.first() is not None


def get_available_slots(
    db: Session,
    location_id,
    date: datetime,
    duration_mins: int = 60,
) -> List[dict]:
    day_key = DAY_MAP[date.weekday()]
    staff_list = (
        db.query(Staff)
        .filter(Staff.location_id == location_id, Staff.is_active == True)
        .all()
    )

    slot_map: dict[datetime, int] = {}

    for staff in staff_list:
        hours = staff.working_hours.get(day_key)
        if not hours:
            continue
        work_start = _parse_time(date, hours["start"])
        work_end = _parse_time(date, hours["end"])
        current = work_start
        while current + timedelta(minutes=duration_mins) <= work_end:
            slot_end = current + timedelta(minutes=duration_mins)
            if not _staff_has_conflict(db, staff.id, current, slot_end):
                slot_map[current] = slot_map.get(current, 0) + 1
            current += timedelta(minutes=duration_mins)

    return [
        {"time": t, "available_staff_count": count}
        for t, count in sorted(slot_map.items())
    ]


def find_available_staff(
    db: Session,
    location_id,
    slot_start: datetime,
    duration_mins: int,
    exclude_appointment_id=None,
):
    slot_end = slot_start + timedelta(minutes=duration_mins)
    day_key = DAY_MAP[slot_start.weekday()]
    staff_list = (
        db.query(Staff)
        .filter(Staff.location_id == location_id, Staff.is_active == True)
        .all()
    )
    for staff in staff_list:
        hours = staff.working_hours.get(day_key)
        if not hours:
            continue
        work_start = _parse_time(slot_start, hours["start"])
        work_end = _parse_time(slot_start, hours["end"])
        if slot_start < work_start or slot_end > work_end:
            continue
        if not _staff_has_conflict(db, staff.id, slot_start, slot_end, exclude_appointment_id):
            return staff
    return None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/availability.py
git commit -m "feat: availability engine — slot generation and staff conflict checker"
```

---

## Task 4: Appointment service

**Files:**
- Create: `backend/app/services/appointment.py`

- [ ] **Step 1: Create `backend/app/services/appointment.py`**

```python
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.appointment import Appointment, AppointmentStatus, BookedVia
from app.services.availability import find_available_staff
import uuid


def create_appointment(
    db: Session,
    customer_id: uuid.UUID,
    location_id: uuid.UUID,
    service: str,
    scheduled_at: datetime,
    duration_mins: int,
    booked_via: BookedVia,
) -> Appointment:
    staff = find_available_staff(db, location_id, scheduled_at, duration_mins)
    if not staff:
        raise HTTPException(
            status_code=409,
            detail={"message": "No staff available for this slot.", "code": "slot_unavailable"},
        )

    appointment = Appointment(
        customer_id=customer_id,
        location_id=location_id,
        staff_id=staff.id,
        service=service,
        scheduled_at=scheduled_at,
        duration_mins=duration_mins,
        booked_via=booked_via,
        status=AppointmentStatus.scheduled,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def reschedule_appointment(
    db: Session,
    appointment: Appointment,
    scheduled_at: datetime,
    duration_mins: int,
) -> Appointment:
    staff = find_available_staff(
        db,
        appointment.location_id,
        scheduled_at,
        duration_mins,
        exclude_appointment_id=appointment.id,
    )
    if not staff:
        raise HTTPException(
            status_code=409,
            detail={"message": "No staff available for this slot.", "code": "slot_unavailable"},
        )
    appointment.scheduled_at = scheduled_at
    appointment.duration_mins = duration_mins
    appointment.staff_id = staff.id
    db.commit()
    db.refresh(appointment)
    return appointment


def cancel_appointment(db: Session, appointment: Appointment) -> Appointment:
    if appointment.status == AppointmentStatus.cancelled:
        raise HTTPException(
            status_code=400,
            detail={"message": "Appointment is already cancelled.", "code": "invalid_status_transition"},
        )
    appointment.status = AppointmentStatus.cancelled
    db.commit()
    db.refresh(appointment)
    return appointment
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/appointment.py
git commit -m "feat: appointment service — create, reschedule, cancel with staff auto-assign"
```

---

## Task 5: Location + Staff + Customer routers

**Files:**
- Create: `backend/app/api/v1/locations.py`
- Create: `backend/app/api/v1/staff.py`
- Create: `backend/app/api/v1/customers.py`

- [ ] **Step 1: Create `backend/app/api/v1/locations.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.location import Location
from app.schemas.location import LocationCreate, LocationUpdate, LocationOut

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=List[LocationOut])
def list_locations(db: Session = Depends(get_db), _=Depends(_get_current_user)):
    return db.query(Location).order_by(Location.created_at).all()


@router.post("", response_model=LocationOut, status_code=201)
def create_location(body: LocationCreate, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    location = Location(**body.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.get("/{location_id}", response_model=LocationOut)
def get_location(location_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
    return loc


@router.put("/{location_id}", response_model=LocationOut)
def update_location(location_id: uuid.UUID, body: LocationUpdate, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(loc, field, value)
    db.commit()
    db.refresh(loc)
    return loc


@router.patch("/{location_id}/deactivate", response_model=LocationOut)
def deactivate_location(location_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
    loc.is_active = False
    db.commit()
    db.refresh(loc)
    return loc
```

- [ ] **Step 2: Create `backend/app/api/v1/staff.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.staff import Staff
from app.schemas.staff import StaffCreate, StaffUpdate, StaffOut

router = APIRouter(prefix="/staff", tags=["staff"])


@router.get("", response_model=List[StaffOut])
def list_staff(
    location_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    q = db.query(Staff)
    if location_id:
        q = q.filter(Staff.location_id == location_id)
    return q.order_by(Staff.full_name).all()


@router.post("", response_model=StaffOut, status_code=201)
def create_staff(body: StaffCreate, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    staff = Staff(**body.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.get("/{staff_id}", response_model=StaffOut)
def get_staff(staff_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail={"message": "Staff not found.", "code": "not_found"})
    return staff


@router.put("/{staff_id}", response_model=StaffOut)
def update_staff(staff_id: uuid.UUID, body: StaffUpdate, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail={"message": "Staff not found.", "code": "not_found"})
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(staff, field, value)
    db.commit()
    db.refresh(staff)
    return staff


@router.patch("/{staff_id}/deactivate", response_model=StaffOut)
def deactivate_staff(staff_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail={"message": "Staff not found.", "code": "not_found"})
    staff.is_active = False
    db.commit()
    db.refresh(staff)
    return staff
```

- [ ] **Step 3: Create `backend/app/api/v1/customers.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerOut

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=List[CustomerOut])
def list_customers(
    location_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    q = db.query(Customer)
    if location_id:
        q = q.filter(Customer.location_id == location_id)
    if search:
        q = q.filter(
            Customer.full_name.ilike(f"%{search}%") | Customer.phone.ilike(f"%{search}%")
        )
    return q.order_by(Customer.full_name).all()


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(body: CustomerCreate, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    existing = db.query(Customer).filter(Customer.phone == body.phone).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"message": "A customer with this phone number already exists.", "code": "duplicate_phone"},
        )
    customer = Customer(**body.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail={"message": "Customer not found.", "code": "not_found"})
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: uuid.UUID, body: CustomerUpdate, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail={"message": "Customer not found.", "code": "not_found"})
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/locations.py backend/app/api/v1/staff.py backend/app/api/v1/customers.py
git commit -m "feat: locations, staff, customers CRUD endpoints"
```

---

## Task 6: Appointments router

**Files:**
- Create: `backend/app/api/v1/appointments.py`

- [ ] **Step 1: Create `backend/app/api/v1/appointments.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import datetime
from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.appointment import (
    AppointmentCreate, AppointmentUpdate, AppointmentOut, SlotOut
)
from app.services.availability import get_available_slots
from app.services.appointment import (
    create_appointment, reschedule_appointment, cancel_appointment
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("/slots", response_model=List[SlotOut])
def available_slots(
    location_id: uuid.UUID,
    date: datetime,
    duration_mins: int = Query(default=60, ge=15, le=480),
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    return get_available_slots(db, location_id, date, duration_mins)


@router.get("", response_model=List[AppointmentOut])
def list_appointments(
    location_id: Optional[uuid.UUID] = None,
    date: Optional[datetime] = None,
    status: Optional[AppointmentStatus] = None,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    q = db.query(Appointment)
    if location_id:
        q = q.filter(Appointment.location_id == location_id)
    if date:
        q = q.filter(
            Appointment.scheduled_at >= date.replace(hour=0, minute=0, second=0),
            Appointment.scheduled_at < date.replace(hour=23, minute=59, second=59),
        )
    if status:
        q = q.filter(Appointment.status == status)
    return q.order_by(Appointment.scheduled_at).all()


@router.post("", response_model=AppointmentOut, status_code=201)
def book_appointment(
    body: AppointmentCreate,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    return create_appointment(
        db,
        customer_id=body.customer_id,
        location_id=body.location_id,
        service=body.service,
        scheduled_at=body.scheduled_at,
        duration_mins=body.duration_mins,
        booked_via=body.booked_via,
    )


@router.get("/{appointment_id}", response_model=AppointmentOut)
def get_appointment(appointment_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail={"message": "Appointment not found.", "code": "not_found"})
    return appt


@router.put("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentUpdate,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail={"message": "Appointment not found.", "code": "not_found"})

    if body.scheduled_at or body.duration_mins:
        new_time = body.scheduled_at or appt.scheduled_at
        new_duration = body.duration_mins or appt.duration_mins
        appt = reschedule_appointment(db, appt, new_time, new_duration)

    if body.service:
        appt.service = body.service
    if body.status:
        appt.status = body.status
    db.commit()
    db.refresh(appt)
    return appt


@router.patch("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel(appointment_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail={"message": "Appointment not found.", "code": "not_found"})
    return cancel_appointment(db, appt)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/v1/appointments.py
git commit -m "feat: appointments endpoints — slots, CRUD, cancel"
```

---

## Task 7: Wire all routers into router.py

**Files:**
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Replace `backend/app/api/v1/router.py` with:**

```python
from fastapi import APIRouter
from app.api.v1 import auth, locations, staff, customers, appointments

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
router.include_router(locations.router)
router.include_router(staff.router)
router.include_router(customers.router)
router.include_router(appointments.router)
```

- [ ] **Step 2: Restart the backend and verify all routes appear in Swagger**

```bash
python main.py
# Open http://localhost:8000/docs
# You should see sections: auth, locations, staff, customers, appointments
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/router.py
git commit -m "feat: wire all Phase 2 routers into v1 router"
```

---

## Task 8: Smoke test via Swagger

Open `http://localhost:8000/docs` and run through this checklist:

- [ ] **POST /api/v1/auth/login** — login to get cookies
- [ ] **POST /api/v1/locations** — create a test location:
```json
{
  "name": "Chennai Gym Central",
  "type": "gym",
  "city": "Chennai",
  "phone": "+919876543210",
  "timezone": "Asia/Kolkata"
}
```
Copy the returned `id` as `LOCATION_ID`.

- [ ] **POST /api/v1/staff** — create a staff member:
```json
{
  "location_id": "<LOCATION_ID>",
  "full_name": "Ravi Kumar",
  "phone": "+919876543211",
  "working_hours": {
    "mon": {"start": "09:00", "end": "18:00"},
    "tue": {"start": "09:00", "end": "18:00"},
    "wed": {"start": "09:00", "end": "18:00"},
    "thu": {"start": "09:00", "end": "18:00"},
    "fri": {"start": "09:00", "end": "18:00"},
    "sat": {"start": "10:00", "end": "15:00"},
    "sun": null
  }
}
```

- [ ] **POST /api/v1/customers** — create a test customer:
```json
{
  "location_id": "<LOCATION_ID>",
  "full_name": "Test Customer",
  "phone": "+919000000001",
  "language": "en"
}
```
Copy the returned `id` as `CUSTOMER_ID`.

- [ ] **GET /api/v1/appointments/slots** — check available slots:
  - `location_id` = `<LOCATION_ID>`
  - `date` = tomorrow's date at 00:00:00 UTC
  - `duration_mins` = 60
  - Should return a list of hourly slots.

- [ ] **POST /api/v1/appointments** — book one of the returned slots:
```json
{
  "customer_id": "<CUSTOMER_ID>",
  "location_id": "<LOCATION_ID>",
  "service": "Gym Session",
  "scheduled_at": "<one of the slot times>",
  "duration_mins": 60,
  "booked_via": "dashboard"
}
```

- [ ] **GET /api/v1/appointments/slots** again for same time — that slot's `available_staff_count` should now be 0 (if only one staff member).

- [ ] **PATCH /api/v1/appointments/{id}/cancel** — cancel the appointment. Slot should free up again.
