from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from datetime import date, timedelta, timezone, datetime

from app.core.database import get_db
from app.api.v1.auth import _get_current_user
from app.models.membership import Membership, PaymentStatus
from app.models.customer import Customer
from app.models.location import Location
from app.schemas.membership import MembershipCreate, MembershipUpdate, MembershipOut

router = APIRouter(prefix="/memberships", tags=["memberships"])


def _enrich(m: Membership, db: Session) -> MembershipOut:
    customer = db.query(Customer).filter(Customer.id == m.customer_id).first()
    location = db.query(Location).filter(Location.id == m.location_id).first()
    return MembershipOut(
        id=m.id,
        customer_id=m.customer_id,
        location_id=m.location_id,
        tier=m.tier,
        starts_at=m.starts_at,
        expires_at=m.expires_at,
        payment_status=m.payment_status,
        renewal_call_sent=m.renewal_call_sent,
        created_at=m.created_at,
        customer_name=customer.full_name if customer else None,
        customer_phone=customer.phone if customer else None,
        location_name=location.name if location else None,
    )


@router.get("", response_model=List[MembershipOut])
def list_memberships(
    location_id: Optional[uuid.UUID] = None,
    customer_id: Optional[uuid.UUID] = None,
    payment_status: Optional[PaymentStatus] = None,
    expiring_days: Optional[int] = Query(None, description="Filter memberships expiring within N days"),
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    q = db.query(Membership)
    if location_id:
        q = q.filter(Membership.location_id == location_id)
    if customer_id:
        q = q.filter(Membership.customer_id == customer_id)
    if payment_status:
        q = q.filter(Membership.payment_status == payment_status)
    if expiring_days is not None:
        today = date.today()
        cutoff = today + timedelta(days=expiring_days)
        q = q.filter(Membership.expires_at >= today, Membership.expires_at <= cutoff)
    memberships = q.order_by(Membership.expires_at).all()
    return [_enrich(m, db) for m in memberships]


@router.post("", response_model=MembershipOut, status_code=201)
def create_membership(
    body: MembershipCreate,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == body.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail={"message": "Customer not found.", "code": "not_found"})

    membership = Membership(
        customer_id=body.customer_id,
        location_id=body.location_id,
        tier=body.tier,
        starts_at=body.starts_at,
        expires_at=body.expires_at,
        payment_status=body.payment_status,
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return _enrich(membership, db)


@router.get("/{membership_id}", response_model=MembershipOut)
def get_membership(
    membership_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    m = db.query(Membership).filter(Membership.id == membership_id).first()
    if not m:
        raise HTTPException(status_code=404, detail={"message": "Membership not found.", "code": "not_found"})
    return _enrich(m, db)


@router.put("/{membership_id}", response_model=MembershipOut)
def update_membership(
    membership_id: uuid.UUID,
    body: MembershipUpdate,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    m = db.query(Membership).filter(Membership.id == membership_id).first()
    if not m:
        raise HTTPException(status_code=404, detail={"message": "Membership not found.", "code": "not_found"})
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return _enrich(m, db)


@router.delete("/{membership_id}", status_code=204)
def delete_membership(
    membership_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    m = db.query(Membership).filter(Membership.id == membership_id).first()
    if not m:
        raise HTTPException(status_code=404, detail={"message": "Membership not found.", "code": "not_found"})
    db.delete(m)
    db.commit()


@router.post("/{membership_id}/trigger-renewal-call", status_code=202)
def trigger_renewal_call(
    membership_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(_get_current_user),
):
    """Manually trigger a renewal call for a specific membership."""
    m = db.query(Membership).filter(Membership.id == membership_id).first()
    if not m:
        raise HTTPException(status_code=404, detail={"message": "Membership not found.", "code": "not_found"})

    if m.payment_status == PaymentStatus.paid:
        raise HTTPException(status_code=400, detail={"message": "Membership is already paid.", "code": "already_paid"})

    customer = db.query(Customer).filter(Customer.id == m.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail={"message": "Customer not found.", "code": "not_found"})

    from app.tasks.bolna_tasks import send_renewal_call
    send_renewal_call.delay(
        membership_id=str(m.id),
        phone=customer.phone,
        variables={
            "customer_name": customer.full_name,
            "tier": m.tier,
            "expiry_date": m.expires_at.strftime("%d %B %Y"),
            "language": customer.language.value,
        },
    )
    m.renewal_call_sent = True
    db.commit()
    return {"status": "queued", "message": f"Renewal call queued for {customer.full_name}"}
