from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    BankActivity,
    BankActivityCategory,
    BankPayee,
    BankPayeeCategoryMap,
)
from app.db.session import get_db
from app.schemas.bank import BankCategoryOut

router = APIRouter()


@router.get("", response_model=list[BankCategoryOut])
def list_bank_categories(
    q: Optional[str] = Query(None),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    direction: str = Query("expense", pattern="^(income|expense)$"),
    limit: int = Query(200, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[BankCategoryOut]:
    if not year and not q:
        categories = db.query(BankActivityCategory).order_by(BankActivityCategory.name).all()
        return [BankCategoryOut(id=cat.id, name=cat.name, total=None) for cat in categories]

    amount_expr = (
        func.coalesce(BankActivity.credit, 0)
        if direction == "income"
        else func.coalesce(BankActivity.debit, 0)
    )
    category_name = func.coalesce(BankActivityCategory.name, "Uncategorized")

    query = (
        db.query(
            BankActivityCategory.id.label("id"),
            category_name.label("name"),
            func.sum(amount_expr).label("total"),
        )
        .select_from(BankActivity)
        .outerjoin(BankPayee, BankActivity.payee_id == BankPayee.id)
        .outerjoin(BankPayeeCategoryMap, BankPayee.id == BankPayeeCategoryMap.payee_id)
        .outerjoin(
            BankActivityCategory,
            BankPayeeCategoryMap.category_id == BankActivityCategory.id,
        )
        .group_by(BankActivityCategory.id, category_name)
        .order_by(func.sum(amount_expr).desc())
    )

    if year:
        query = query.filter(func.extract("year", BankActivity.activity_date) == year)
    query = query.filter(amount_expr > 0)
    if q:
        query = query.filter(category_name.ilike(f"%{q}%"))

    rows = query.limit(limit).offset(offset).all()
    return [
        BankCategoryOut(id=row.id, name=row.name, total=row.total or 0)
        for row in rows
    ]
