from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Category, Merchant, MerchantCategoryMap, Transaction
from app.db.session import get_db
from app.schemas.transactions import TransactionList, TransactionOut

router = APIRouter()


@router.get("", response_model=TransactionList)
def list_transactions(
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> TransactionList:
    total = db.query(func.count(Transaction.id)).scalar() or 0

    query = (
        db.query(
            Transaction,
            Category.name.label("category_name"),
        )
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
        .limit(limit)
        .offset(offset)
    )

    items = []
    for transaction, category_name in query.all():
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
                category_name=category_name,
            )
        )

    return TransactionList(total=total, items=items)
