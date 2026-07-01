from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from typing import List
import uuid
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.api.v1.auth import _get_current_user
from app.models.location import Location
from app.models.user import User
from app.schemas.location import (
    LocationCreate,
    LocationUpdate,
    LocationOut,
    LocationSelectRequest,
    WhatsAppConnectRequest,
    WhatsAppStatusOut,
)

router = APIRouter(prefix="/locations", tags=["locations"])

ACTIVE_LOCATION_COOKIE = "active_location_id"
COOKIE_OPTS = dict(httponly=True, samesite="lax", secure=False, max_age=604800)


def _location_query_for_user(db: Session, user: User):
    return db.query(Location).filter(
        (Location.owner_id == user.id) | (Location.owner_id.is_(None))
    )


def _to_out(loc: Location) -> LocationOut:
    return LocationOut(
        id=loc.id,
        name=loc.name,
        type=loc.type,
        city=loc.city,
        phone=loc.phone,
        timezone=loc.timezone,
        is_active=loc.is_active,
        has_password=bool(loc.password_hash),
        knowledge_base=loc.knowledge_base,
        whatsapp_connected=loc.whatsapp_connected,
        whatsapp_display_phone=loc.whatsapp_display_phone,
        created_at=loc.created_at,
    )


def _get_active_location_id(request: Request) -> uuid.UUID | None:
    raw = request.cookies.get(ACTIVE_LOCATION_COOKIE)
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        return None


def _verify_location_password(loc: Location, password: str) -> None:
    if not loc.password_hash:
        raise HTTPException(
            status_code=401,
            detail={"message": "This location has no password set. Ask the account owner to set one.", "code": "no_password"},
        )
    if not verify_password(password, loc.password_hash):
        raise HTTPException(
            status_code=401,
            detail={"message": "Incorrect location password.", "code": "invalid_password"},
        )


@router.get("", response_model=List[LocationOut])
def list_locations(db: Session = Depends(get_db), user: User = Depends(_get_current_user)):
    locations = _location_query_for_user(db, user).order_by(Location.created_at).all()
    return [_to_out(l) for l in locations]


@router.get("/active", response_model=LocationOut | None)
def get_active_location(request: Request, db: Session = Depends(get_db), user: User = Depends(_get_current_user)):
    loc_id = _get_active_location_id(request)
    if not loc_id:
        return None
    loc = _location_query_for_user(db, user).filter(Location.id == loc_id, Location.is_active == True).first()
    if not loc:
        return None
    return _to_out(loc)


@router.post("/select")
def select_location(
    body: LocationSelectRequest,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(_get_current_user),
):
    loc = _location_query_for_user(db, user).filter(
        Location.id == body.location_id, Location.is_active == True
    ).first()
    if not loc:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
    _verify_location_password(loc, body.password)
    response.set_cookie(ACTIVE_LOCATION_COOKIE, str(loc.id), **COOKIE_OPTS)
    return {"message": "Location selected", "location": _to_out(loc)}


@router.post("/clear-active")
def clear_active_location(response: Response, _=Depends(_get_current_user)):
    response.delete_cookie(ACTIVE_LOCATION_COOKIE)
    return {"message": "Active location cleared"}


@router.post("", response_model=LocationOut, status_code=201)
def create_location(body: LocationCreate, db: Session = Depends(get_db), user: User = Depends(_get_current_user)):
    data = body.model_dump(exclude={"password"})
    location = Location(
        **data,
        owner_id=user.id,
        password_hash=hash_password(body.password),
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return _to_out(location)


@router.get("/{location_id}", response_model=LocationOut)
def get_location(location_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(_get_current_user)):
    loc = _location_query_for_user(db, user).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
    return _to_out(loc)


@router.put("/{location_id}", response_model=LocationOut)
def update_location(
    location_id: uuid.UUID,
    body: LocationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(_get_current_user),
):
    loc = _location_query_for_user(db, user).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
    updates = body.model_dump(exclude_none=True, exclude={"password"})
    for field, value in updates.items():
        setattr(loc, field, value)
    if body.password:
        loc.password_hash = hash_password(body.password)
    db.commit()
    db.refresh(loc)
    return _to_out(loc)


@router.patch("/{location_id}/deactivate", response_model=LocationOut)
def deactivate_location(location_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(_get_current_user)):
    loc = _location_query_for_user(db, user).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
    loc.is_active = False
    db.commit()
    db.refresh(loc)
    return _to_out(loc)


@router.put("/{location_id}/whatsapp", response_model=WhatsAppStatusOut)
def connect_whatsapp(
    location_id: uuid.UUID,
    body: WhatsAppConnectRequest,
    db: Session = Depends(get_db),
    user: User = Depends(_get_current_user),
):
    loc = _location_query_for_user(db, user).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
    loc.whatsapp_phone_number_id = body.phone_number_id.strip()
    loc.whatsapp_waba_id = body.waba_id.strip()
    loc.whatsapp_access_token = body.access_token.strip()
    loc.whatsapp_display_phone = body.display_phone.strip() if body.display_phone else None
    db.commit()
    return WhatsAppStatusOut(
        connected=True,
        display_phone=loc.whatsapp_display_phone,
        phone_number_id=loc.whatsapp_phone_number_id,
        waba_id=loc.whatsapp_waba_id,
    )


@router.delete("/{location_id}/whatsapp", response_model=WhatsAppStatusOut)
def disconnect_whatsapp(location_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(_get_current_user)):
    loc = _location_query_for_user(db, user).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
    loc.whatsapp_phone_number_id = None
    loc.whatsapp_waba_id = None
    loc.whatsapp_access_token = None
    loc.whatsapp_display_phone = None
    db.commit()
    return WhatsAppStatusOut(connected=False)


@router.get("/{location_id}/whatsapp", response_model=WhatsAppStatusOut)
def whatsapp_status(location_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(_get_current_user)):
    loc = _location_query_for_user(db, user).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail={"message": "Location not found.", "code": "not_found"})
    return WhatsAppStatusOut(
        connected=loc.whatsapp_connected,
        display_phone=loc.whatsapp_display_phone,
        phone_number_id=loc.whatsapp_phone_number_id,
        waba_id=loc.whatsapp_waba_id,
    )
