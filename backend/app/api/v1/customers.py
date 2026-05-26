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


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(_get_current_user)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail={"message": "Customer not found.", "code": "not_found"})
    db.delete(customer)
    db.commit()


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
