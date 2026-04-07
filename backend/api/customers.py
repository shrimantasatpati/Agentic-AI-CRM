"""Customers API Endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from database.connection import get_db
from database.models import Customer, Company

router = APIRouter()


class CustomerResponse(BaseModel):
    id: str
    plan: str
    mrr: float
    churn_risk: str
    company_name: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=List[CustomerResponse])
@router.get("/list", response_model=List[CustomerResponse])
async def list_customers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all customers with their company names"""
    customers = (
        db.query(Customer)
        .options(joinedload(Customer.company))
        .offset(skip)
        .limit(limit)
        .all()
    )
    result = []
    for c in customers:
        result.append(CustomerResponse(
            id=c.id,
            plan=c.plan or "Unknown",
            mrr=c.mrr or 0,
            churn_risk=c.churn_risk or "low",
            company_name=c.company.name if c.company else f"Customer #{c.id[:4].upper()}",
        ))
    return result


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str, db: Session = Depends(get_db)):
    """Get customer by ID"""
    customer = (
        db.query(Customer)
        .options(joinedload(Customer.company))
        .filter(Customer.id == customer_id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse(
        id=customer.id,
        plan=customer.plan or "Unknown",
        mrr=customer.mrr or 0,
        churn_risk=customer.churn_risk or "low",
        company_name=customer.company.name if customer.company else f"Customer #{customer.id[:4].upper()}",
    )


@router.get("/{customer_id}/health")
async def get_customer_health(customer_id: str, db: Session = Depends(get_db)):
    """Get customer health metrics"""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return {
        "churn_risk": customer.churn_risk,
        "churn_probability": customer.churn_probability,
        "engagement": {
            "logins_per_week": customer.logins_per_week,
            "features_used": customer.features_used,
            "license_usage_percent": customer.license_usage_percent
        }
    }
