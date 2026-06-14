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


@router.delete("/{staff_id}", status_code=204)
def delete_staff(staff_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail={"message": "Staff not found.", "code": "not_found"})
    from app.models.appointment import Appointment
    db.query(Appointment).filter(Appointment.staff_id == staff_id).update({"staff_id": None})
    db.delete(staff)
    db.commit()


@router.patch("/{staff_id}/deactivate", response_model=StaffOut)
def deactivate_staff(staff_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail={"message": "Staff not found.", "code": "not_found"})
    staff.is_active = False
    db.commit()
    db.refresh(staff)
    return staff
