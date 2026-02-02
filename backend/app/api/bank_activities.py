from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, aliased

from app.db.models import (
    BankActivity,
    BankActivityCategory,
    BankPayee,
    BankPayeeCategoryMap,
)
from app.db.session import get_db
from app.schemas.bank import BankActivityList, BankActivityOut, BankActivityUpdate

router = APIRouter()


@router.get("", response_model=BankActivityList)
def list_bank_activities(
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    category_id: Optional[int] = Query(None, ge=1),
    category_name: Optional[str] = Query(None, min_length=1),
    payee_id: Optional[int] = Query(None, ge=1),
    import_batch_id: Optional[int] = Query(None, ge=1),
    direction: Optional[str] = Query(None, pattern="^(income|expense)$"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    q: Optional[str] = Query(None, min_length=1),
    db: Session = Depends(get_db),
) -> BankActivityList:
    manual_category = aliased(BankActivityCategory)
    category_label = func.coalesce(
        manual_category.name,
        BankActivity.raw_category_text,
        BankActivityCategory.name,
        "Uncategorized",
    )
    category_id_value = func.coalesce(
        manual_category.id, BankPayeeCategoryMap.category_id
    )

    query = (
        db.query(
            BankActivity,
            BankPayee.display_name.label("payee_name"),
            category_id_value.label("category_id"),
            category_label.label("category_name"),
        )
        .outerjoin(BankPayee, BankActivity.payee_id == BankPayee.id)
        .outerjoin(BankPayeeCategoryMap, BankPayee.id == BankPayeeCategoryMap.payee_id)
        .outerjoin(
            BankActivityCategory,
            BankPayeeCategoryMap.category_id == BankActivityCategory.id,
        )
        .outerjoin(manual_category, BankActivity.manual_category_id == manual_category.id)
        .order_by(BankActivity.activity_date.desc(), BankActivity.id.desc())
    )

    if year:
        query = query.filter(func.extract("year", BankActivity.activity_date) == year)
    if month:
        query = query.filter(func.extract("month", BankActivity.activity_date) == month)
    if category_id:
        query = query.filter(
            or_(
                BankActivity.manual_category_id == category_id,
                and_(
                    BankActivity.manual_category_id.is_(None),
                    BankPayeeCategoryMap.category_id == category_id,
                ),
            )
        )
    if category_name:
        query = query.filter(category_label == category_name)
    if payee_id:
        query = query.filter(BankActivity.payee_id == payee_id)
    if import_batch_id:
        query = query.filter(BankActivity.import_batch_id == import_batch_id)
    if date_from:
        query = query.filter(BankActivity.activity_date >= date_from)
    if date_to:
        query = query.filter(BankActivity.activity_date <= date_to)
    if q:
        query = query.filter(
            or_(
                BankActivity.description.ilike(f"%{q}%"),
                BankActivity.payee_raw.ilike(f"%{q}%"),
                BankPayee.display_name.ilike(f"%{q}%"),
                BankActivity.reference.ilike(f"%{q}%"),
            )
        )
    if direction == "income":
        query = query.filter(BankActivity.credit.isnot(None))
    elif direction == "expense":
        query = query.filter(BankActivity.debit.isnot(None))

    total = (
        query.order_by(None)
        .with_entities(func.count(func.distinct(BankActivity.id)))
        .scalar()
        or 0
    )

    rows = query.limit(limit).offset(offset).all()
    items = []
    for activity, payee_name, category_id_value, category_name in rows:
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
                category_id=category_id_value,
                category_name=category_name,
            )
        )

    return BankActivityList(total=total, items=items)


@router.patch("/{activity_id}", response_model=BankActivityOut)
def update_bank_activity(
    activity_id: int,
    payload: BankActivityUpdate,
    db: Session = Depends(get_db),
) -> BankActivityOut:
    activity = db.query(BankActivity).filter(BankActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    if payload.category_id is None:
        activity.manual_category_id = None
    else:
        category = (
            db.query(BankActivityCategory)
            .filter(BankActivityCategory.id == payload.category_id)
            .first()
        )
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        activity.manual_category_id = category.id

    db.commit()

    manual_category = aliased(BankActivityCategory)
    category_label = func.coalesce(
        manual_category.name,
        activity.raw_category_text,
        BankActivityCategory.name,
        "Uncategorized",
    )
    category_id_value = func.coalesce(
        manual_category.id, BankPayeeCategoryMap.category_id
    )
    row = (
        db.query(
            BankActivity,
            BankPayee.display_name.label("payee_name"),
            category_id_value.label("category_id"),
            category_label.label("category_name"),
        )
        .outerjoin(BankPayee, BankActivity.payee_id == BankPayee.id)
        .outerjoin(BankPayeeCategoryMap, BankPayee.id == BankPayeeCategoryMap.payee_id)
        .outerjoin(
            BankActivityCategory,
            BankPayeeCategoryMap.category_id == BankActivityCategory.id,
        )
        .outerjoin(manual_category, BankActivity.manual_category_id == manual_category.id)
        .filter(BankActivity.id == activity_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity, payee_name, category_id_value, category_name = row
    return BankActivityOut(
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
        category_id=category_id_value,
        category_name=category_name,
    )
