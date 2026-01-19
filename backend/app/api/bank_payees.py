from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    BankActivity,
    BankActivityCategory,
    BankPayee,
    BankPayeeCategoryMap,
)
from app.db.session import get_db
from app.schemas.bank import BankPayeeOut, BankUnknownPayee

router = APIRouter()


@router.get("/unknown", response_model=list[BankUnknownPayee])
def list_unknown_payees(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[BankUnknownPayee]:
    query = (
        db.query(
            BankPayee.id,
            BankPayee.display_name,
            BankPayee.normalized_name,
            func.count(BankActivity.id).label("activity_count"),
        )
        .outerjoin(BankPayeeCategoryMap, BankPayee.id == BankPayeeCategoryMap.payee_id)
        .outerjoin(BankActivity, BankPayee.id == BankActivity.payee_id)
        .filter(BankPayeeCategoryMap.id.is_(None))
        .group_by(BankPayee.id)
        .order_by(func.count(BankActivity.id).desc())
        .limit(limit)
    )

    return [
        BankUnknownPayee(
            id=row.id,
            display_name=row.display_name,
            normalized_name=row.normalized_name,
            activity_count=row.activity_count,
        )
        for row in query.all()
    ]


@router.get("", response_model=list[BankPayeeOut])
def search_payees(
    q: Optional[str] = Query(None),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[BankPayeeOut]:
    amount_expr = func.coalesce(BankActivity.debit, BankActivity.credit, 0)

    query = (
        db.query(
            BankPayee.id.label("id"),
            BankPayee.display_name.label("name"),
            func.sum(amount_expr).label("total"),
        )
        .outerjoin(BankActivity, BankPayee.id == BankActivity.payee_id)
        .group_by(BankPayee.id, BankPayee.display_name)
        .order_by(func.sum(amount_expr).desc())
    )

    if year:
        query = query.filter(func.extract("year", BankActivity.activity_date) == year)
    if q:
        query = query.filter(BankPayee.display_name.ilike(f"%{q}%"))

    rows = query.limit(limit).offset(offset).all()
    return [BankPayeeOut(id=row.id, name=row.name, total=row.total or 0) for row in rows]


@router.post("/{payee_id}/category")
def assign_category(
    payee_id: int,
    category_id: int,
    db: Session = Depends(get_db),
) -> dict:
    payee = db.query(BankPayee).filter(BankPayee.id == payee_id).one_or_none()
    if not payee:
        raise HTTPException(status_code=404, detail="Payee not found")

    category = (
        db.query(BankActivityCategory)
        .filter(BankActivityCategory.id == category_id)
        .one_or_none()
    )
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    mapping = (
        db.query(BankPayeeCategoryMap)
        .filter(BankPayeeCategoryMap.payee_id == payee.id)
        .one_or_none()
    )
    if mapping:
        mapping.category_id = category.id
    else:
        db.add(BankPayeeCategoryMap(payee_id=payee.id, category_id=category.id))

    db.commit()
    return {"status": "ok"}
