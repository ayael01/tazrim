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
from app.schemas.bank import BankActivityList, BankActivityOut

router = APIRouter()


@router.get("", response_model=BankActivityList)
def list_bank_activities(
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    category_id: Optional[int] = Query(None, ge=1),
    payee_id: Optional[int] = Query(None, ge=1),
    import_batch_id: Optional[int] = Query(None, ge=1),
    direction: Optional[str] = Query(None, pattern="^(income|expense)$"),
    db: Session = Depends(get_db),
) -> BankActivityList:
    total_query = db.query(func.count(BankActivity.id))

    category_name = func.coalesce(
        BankActivity.raw_category_text, BankActivityCategory.name, "Uncategorized"
    )

    query = (
        db.query(
            BankActivity,
            BankPayee.display_name.label("payee_name"),
            category_name.label("category_name"),
        )
        .outerjoin(BankPayee, BankActivity.payee_id == BankPayee.id)
        .outerjoin(BankPayeeCategoryMap, BankPayee.id == BankPayeeCategoryMap.payee_id)
        .outerjoin(
            BankActivityCategory,
            BankPayeeCategoryMap.category_id == BankActivityCategory.id,
        )
        .order_by(BankActivity.activity_date.desc(), BankActivity.id.desc())
    )

    if year:
        query = query.filter(func.extract("year", BankActivity.activity_date) == year)
        total_query = total_query.filter(func.extract("year", BankActivity.activity_date) == year)
    if month:
        query = query.filter(func.extract("month", BankActivity.activity_date) == month)
        total_query = total_query.filter(func.extract("month", BankActivity.activity_date) == month)
    if category_id:
        query = query.filter(BankPayeeCategoryMap.category_id == category_id)
        total_query = total_query.filter(BankPayeeCategoryMap.category_id == category_id)
    if payee_id:
        query = query.filter(BankActivity.payee_id == payee_id)
        total_query = total_query.filter(BankActivity.payee_id == payee_id)
    if import_batch_id:
        query = query.filter(BankActivity.import_batch_id == import_batch_id)
        total_query = total_query.filter(BankActivity.import_batch_id == import_batch_id)
    if direction == "income":
        query = query.filter(BankActivity.credit.isnot(None))
        total_query = total_query.filter(BankActivity.credit.isnot(None))
    elif direction == "expense":
        query = query.filter(BankActivity.debit.isnot(None))
        total_query = total_query.filter(BankActivity.debit.isnot(None))

    total = total_query.scalar() or 0

    rows = query.limit(limit).offset(offset).all()
    items = []
    for activity, payee_name, category_name in rows:
        items.append(
            BankActivityOut(
                id=activity.id,
                activity_date=activity.activity_date.isoformat(),
                value_date=activity.value_date.isoformat() if activity.value_date else None,
                description=activity.description,
                reference=activity.reference,
                debit=activity.debit,
                credit=activity.credit,
                balance=activity.balance,
                currency=activity.currency,
                payee_name=payee_name,
                category_name=category_name,
            )
        )

    return BankActivityList(total=total, items=items)
