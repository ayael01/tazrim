from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Category, Merchant, MerchantCategoryMap, Transaction
from app.db.session import get_db
from app.schemas.merchants import MerchantSearchResult, UnknownMerchant

router = APIRouter()


@router.get("/unknown", response_model=list[UnknownMerchant])
def list_unknown_merchants(
    limit: int = 200,
    db: Session = Depends(get_db),
) -> list[UnknownMerchant]:
    query = (
        db.query(
            Merchant.id,
            Merchant.display_name,
            Merchant.normalized_name,
            func.count(Transaction.id).label("transaction_count"),
        )
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Transaction, Merchant.id == Transaction.merchant_id)
        .filter(MerchantCategoryMap.id.is_(None))
        .group_by(Merchant.id)
        .order_by(func.count(Transaction.id).desc())
        .limit(limit)
    )

    return [
        UnknownMerchant(
            id=row.id,
            display_name=row.display_name,
            normalized_name=row.normalized_name,
            transaction_count=row.transaction_count,
        )
        for row in query.all()
    ]


@router.get("", response_model=list[MerchantSearchResult])
def search_merchants(
    q: Optional[str] = Query(None),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[MerchantSearchResult]:
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    merchant_name = func.coalesce(Merchant.display_name, Transaction.merchant_raw)

    query = (
        db.query(
            Merchant.id.label("id"),
            merchant_name.label("name"),
            func.sum(amount_expr).label("total"),
        )
        .outerjoin(Transaction, Merchant.id == Transaction.merchant_id)
        .group_by(Merchant.id, merchant_name)
        .order_by(func.sum(amount_expr).desc())
    )

    if year:
        query = query.filter(func.extract("year", Transaction.transaction_date) == year)

    if q:
        query = query.filter(merchant_name.ilike(f"%{q}%"))

    rows = query.limit(limit).all()
    return [MerchantSearchResult(id=row.id, name=row.name, total=row.total or 0) for row in rows]


@router.post("/{merchant_id}/category")
def assign_category(
    merchant_id: int,
    category_id: int,
    db: Session = Depends(get_db),
) -> dict:
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    category = db.query(Category).filter(Category.id == category_id).one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    mapping = (
        db.query(MerchantCategoryMap)
        .filter(MerchantCategoryMap.merchant_id == merchant.id)
        .one_or_none()
    )
    if mapping:
        mapping.category_id = category.id
    else:
        db.add(MerchantCategoryMap(merchant_id=merchant.id, category_id=category.id))

    db.commit()
    return {"status": "ok"}
