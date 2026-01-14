from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Merchant, MerchantCategoryMap, Transaction
from app.db.session import get_db
from app.schemas.merchants import UnknownMerchant

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
