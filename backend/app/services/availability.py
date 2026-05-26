from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import List
from sqlalchemy.orm import Session
from app.models.staff import Staff
from app.models.appointment import Appointment, AppointmentStatus

DAY_MAP = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}
IST = ZoneInfo("Asia/Kolkata")


def _parse_time(date: datetime, time_str: str) -> datetime:
    h, m = map(int, time_str.split(":"))
    # Treat working hours as IST wall-clock time
    return date.replace(hour=h, minute=m, second=0, microsecond=0, tzinfo=IST)


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
    )
    if exclude_appointment_id:
        q = q.filter(Appointment.id != exclude_appointment_id)
    for appt in q.all():
        appt_end = appt.scheduled_at + timedelta(minutes=appt.duration_mins)
        if appt.scheduled_at < slot_end and appt_end > slot_start:
            return True
    return False


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

    slot_map: dict = {}

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
