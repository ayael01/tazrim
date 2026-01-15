from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Category, Merchant, MerchantCategoryMap, Transaction
from app.db.session import get_db
from app.schemas.categories import CategoryOut

router = APIRouter()


@router.get("", response_model=List[CategoryOut])
def list_categories(
    q: Optional[str] = Query(None),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    limit: int = Query(200, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> List[CategoryOut]:
    if not year and not q:
        categories = db.query(Category).order_by(Category.name).all()
        return [CategoryOut(id=cat.id, name=cat.name, total=None) for cat in categories]

    category_name = func.coalesce(Category.name, "Uncategorized")
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)

    query = (
        db.query(
            Category.id,
            category_name.label("name"),
            func.sum(amount_expr).label("total"),
        )
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .group_by(Category.id, category_name)
        .order_by(func.sum(amount_expr).desc())
    )

    if year:
        query = query.filter(func.extract("year", Transaction.transaction_date) == year)
    if q:
        query = query.filter(category_name.ilike(f"%{q}%"))

    rows = query.limit(limit).offset(offset).all()
    return [CategoryOut(id=row.id, name=row.name, total=row.total) for row in rows]
