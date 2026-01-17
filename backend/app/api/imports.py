from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import CardAccount, ImportBatch, Merchant, MerchantCategoryMap, Transaction
from app.db.session import get_db
from app.schemas.imports import ImportBatchOut, ImportSummary
from app.services.importer import parse_transactions_csv

router = APIRouter()


@router.post("", response_model=ImportSummary)
def import_transactions(
    period_month: str = Form(...),
    card_name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ImportSummary:
    try:
        month = datetime.strptime(period_month, "%Y-%m").date().replace(day=1)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="period_month must be YYYY-MM") from exc

    try:
        default_posting_date = month
        rows = parse_transactions_csv(file, default_posting_date=default_posting_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    card = db.query(CardAccount).filter(CardAccount.name == card_name).one_or_none()
    if not card:
        card = CardAccount(name=card_name)
        db.add(card)
        db.flush()

    import_batch = ImportBatch(
        card_account_id=card.id,
        source_filename=file.filename,
        period_month=month,
    )
    db.add(import_batch)
    db.flush()

    normalized_names = {row["normalized_merchant"] for row in rows}
    existing_merchants = (
        db.query(Merchant)
        .filter(Merchant.normalized_name.in_(normalized_names))
        .all()
    )
    merchants_by_normalized = {
        merchant.normalized_name: merchant for merchant in existing_merchants
    }

    new_merchants = 0
    for row in rows:
        normalized_name = row["normalized_merchant"]
        if normalized_name not in merchants_by_normalized:
            merchant = Merchant(
                normalized_name=normalized_name,
                display_name=row["merchant_raw"],
            )
            db.add(merchant)
            merchants_by_normalized[normalized_name] = merchant
            new_merchants += 1

    db.flush()

    transactions = []
    for row in rows:
        merchant = merchants_by_normalized[row["normalized_merchant"]]
        transactions.append(
            Transaction(
                card_account_id=card.id,
                import_batch_id=import_batch.id,
                transaction_date=row["transaction_date"],
                posting_date=row["posting_date"],
                merchant_raw=row["merchant_raw"],
                merchant_id=merchant.id,
                transaction_amount=row["transaction_amount"],
                transaction_currency=row["transaction_currency"],
                charged_amount=row["charged_amount"],
                charged_currency=row["charged_currency"],
            )
        )

    db.add_all(transactions)

    merchant_ids = {merchant.id for merchant in merchants_by_normalized.values()}
    mapped_ids = {
        merchant_id
        for (merchant_id,) in db.query(MerchantCategoryMap.merchant_id)
        .filter(MerchantCategoryMap.merchant_id.in_(merchant_ids))
        .all()
    }
    unknown_merchants = len(merchant_ids - mapped_ids)

    db.commit()

    return ImportSummary(
        import_id=import_batch.id,
        total_rows=len(rows),
        inserted_rows=len(transactions),
        new_merchants=new_merchants,
        unknown_merchants=unknown_merchants,
    )


@router.get("", response_model=list[ImportBatchOut])
def list_imports(
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[ImportBatchOut]:
    rows = (
        db.query(
            ImportBatch.id,
            ImportBatch.source_filename,
            ImportBatch.period_month,
            ImportBatch.uploaded_at,
            func.count(Transaction.id).label("row_count"),
        )
        .outerjoin(Transaction, Transaction.import_batch_id == ImportBatch.id)
        .group_by(ImportBatch.id)
        .order_by(ImportBatch.uploaded_at.desc())
        .limit(limit)
        .all()
    )

    return [
        ImportBatchOut(
            id=row.id,
            source_filename=row.source_filename,
            period_month=row.period_month.isoformat(),
            uploaded_at=row.uploaded_at.isoformat(),
            row_count=row.row_count,
        )
        for row in rows
    ]


@router.delete("/{import_id}")
def delete_import(
    import_id: int,
    db: Session = Depends(get_db),
) -> dict:
    batch = db.query(ImportBatch).filter(ImportBatch.id == import_id).one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")

    db.query(Transaction).filter(Transaction.import_batch_id == import_id).delete()
    db.delete(batch)
    db.commit()
    return {"status": "ok"}
