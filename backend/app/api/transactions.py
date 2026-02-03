from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, aliased

from app.db.models import Category, Merchant, MerchantCategoryMap, Transaction
from app.db.session import get_db
from app.schemas.transactions import (
    TransactionList,
    TransactionMonthList,
    TransactionOut,
    TransactionUpdate,
)

router = APIRouter()


@router.get("", response_model=TransactionList)
def list_transactions(
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    import_batch_id: Optional[int] = Query(None, ge=1),
    category_id: Optional[int] = Query(None, ge=1),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    q: Optional[str] = Query(None, min_length=1),
    db: Session = Depends(get_db),
) -> TransactionList:
    manual_category = aliased(Category)
    category_label = func.coalesce(
        manual_category.name,
        Category.name,
        "Uncategorized",
    )
    category_id_value = func.coalesce(
        manual_category.id, MerchantCategoryMap.category_id
    )
    query = (
        db.query(
            Transaction,
            category_id_value.label("category_id"),
            category_label.label("category_name"),
        )
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .outerjoin(manual_category, Transaction.manual_category_id == manual_category.id)
        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
    )

    if import_batch_id:
        query = query.filter(Transaction.import_batch_id == import_batch_id)
    if category_id:
        query = query.filter(
            or_(
                Transaction.manual_category_id == category_id,
                and_(
                    Transaction.manual_category_id.is_(None),
                    MerchantCategoryMap.category_id == category_id,
                ),
            )
        )
    if date_from:
        query = query.filter(Transaction.transaction_date >= date_from)
    if date_to:
        query = query.filter(Transaction.transaction_date <= date_to)
    if q:
        query = query.filter(
            or_(
                Transaction.merchant_raw.ilike(f"%{q}%"),
                Merchant.display_name.ilike(f"%{q}%"),
            )
        )

    total = (
        query.order_by(None)
        .with_entities(func.count(func.distinct(Transaction.id)))
        .scalar()
        or 0
    )

    query = query.limit(limit).offset(offset)

    items = []
    for transaction, category_id_value, category_name in query.all():
        items.append(
            TransactionOut(
                id=transaction.id,
                transaction_date=transaction.transaction_date,
                posting_date=transaction.posting_date,
                merchant_raw=transaction.merchant_raw,
                amount=transaction.transaction_amount,
                currency=transaction.transaction_currency,
                charged_amount=transaction.charged_amount,
                charged_currency=transaction.charged_currency,
                manual_category_id=transaction.manual_category_id,
                category_id=category_id_value,
                category_name=category_name,
            )
        )

    return TransactionList(total=total, items=items)


@router.get("/merchant-month", response_model=TransactionMonthList)
def merchant_month_transactions(
    merchant_id: int = Query(..., ge=1),
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
) -> TransactionMonthList:
    month_start = datetime(year, month, 1)
    month_end = datetime(year + (month == 12), 1 if month == 12 else month + 1, 1)

    manual_category = aliased(Category)
    category_label = func.coalesce(
        manual_category.name,
        Category.name,
        "Uncategorized",
    )
    category_id_value = func.coalesce(
        manual_category.id, MerchantCategoryMap.category_id
    )
    query = (
        db.query(
            Transaction,
            category_id_value.label("category_id"),
            category_label.label("category_name"),
        )
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .outerjoin(manual_category, Transaction.manual_category_id == manual_category.id)
        .filter(Transaction.merchant_id == merchant_id)
        .filter(Transaction.transaction_date >= month_start)
        .filter(Transaction.transaction_date < month_end)
        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
    )

    items = []
    for transaction, category_id_value, category_name in query.all():
        items.append(
            TransactionOut(
                id=transaction.id,
                transaction_date=transaction.transaction_date,
                posting_date=transaction.posting_date,
                merchant_raw=transaction.merchant_raw,
                amount=transaction.transaction_amount,
                currency=transaction.transaction_currency,
                charged_amount=transaction.charged_amount,
                charged_currency=transaction.charged_currency,
                manual_category_id=transaction.manual_category_id,
                category_id=category_id_value,
                category_name=category_name,
            )
        )

    month_label = f"{year:04d}-{month:02d}"
    return TransactionMonthList(month=month_label, items=items)


@router.patch("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
) -> TransactionOut:
    transaction = (
        db.query(Transaction).filter(Transaction.id == transaction_id).first()
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if payload.category_id is None:
        transaction.manual_category_id = None
    else:
        category = (
            db.query(Category).filter(Category.id == payload.category_id).first()
        )
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        transaction.manual_category_id = category.id

    db.commit()

    manual_category = aliased(Category)
    category_label = func.coalesce(
        manual_category.name,
        Category.name,
        "Uncategorized",
    )
    category_id_value = func.coalesce(
        manual_category.id, MerchantCategoryMap.category_id
    )
    row = (
        db.query(
            Transaction,
            category_id_value.label("category_id"),
            category_label.label("category_name"),
        )
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .outerjoin(manual_category, Transaction.manual_category_id == manual_category.id)
        .filter(Transaction.id == transaction_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Transaction not found")

    transaction, category_id_value, category_name = row
    return TransactionOut(
        id=transaction.id,
        transaction_date=transaction.transaction_date,
        posting_date=transaction.posting_date,
        merchant_raw=transaction.merchant_raw,
        amount=transaction.transaction_amount,
        currency=transaction.transaction_currency,
        charged_amount=transaction.charged_amount,
        charged_currency=transaction.charged_currency,
        manual_category_id=transaction.manual_category_id,
        category_id=category_id_value,
        category_name=category_name,
    )
