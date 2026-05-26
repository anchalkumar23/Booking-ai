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
