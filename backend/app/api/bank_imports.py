from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    BankAccount,
    BankActivity,
    BankActivityCategory,
    BankActivityImportBatch,
    BankPayee,
    BankPayeeCategoryMap,
)
from app.db.session import get_db
from app.schemas.bank import BankImportBatchOut, BankImportSummary
from app.services.bank_importer import parse_bank_activities_csv

router = APIRouter()


@router.post("", response_model=BankImportSummary)
def import_bank_activities(
    period_month: str = Form(...),
    account_name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> BankImportSummary:
    try:
        month = datetime.strptime(period_month, "%Y-%m").date().replace(day=1)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="period_month must be YYYY-MM") from exc

    try:
        rows = parse_bank_activities_csv(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    account = (
        db.query(BankAccount).filter(BankAccount.name == account_name).one_or_none()
    )
    if not account:
        account = BankAccount(name=account_name)
        db.add(account)
        db.flush()

    import_batch = BankActivityImportBatch(
        bank_account_id=account.id,
        source_filename=file.filename,
        period_month=month,
        row_count=len(rows),
    )
    db.add(import_batch)
    db.flush()

    normalized_names = {row["normalized_payee"] for row in rows}
    existing_payees = (
        db.query(BankPayee)
        .filter(BankPayee.normalized_name.in_(normalized_names))
        .all()
    )
    payees_by_normalized = {payee.normalized_name: payee for payee in existing_payees}

    new_payees = 0
    for row in rows:
        normalized_name = row["normalized_payee"]
        if normalized_name not in payees_by_normalized:
            payee = BankPayee(
                normalized_name=normalized_name,
                display_name=row["payee_raw"],
            )
            db.add(payee)
            payees_by_normalized[normalized_name] = payee
            new_payees += 1

    db.flush()

    categories_by_name = {
        category.name: category
        for category in db.query(BankActivityCategory).all()
    }
    payee_category_map = {
        link.payee_id: link
        for link in db.query(BankPayeeCategoryMap).all()
    }
    payee_category_options = defaultdict(set)
    for row in rows:
        raw_category = row.get("raw_category_text")
        if not raw_category:
            continue
        payee_category_options[row["normalized_payee"]].add(raw_category)

    for row in rows:
        raw_category = row.get("raw_category_text")
        if not raw_category:
            continue
        category = categories_by_name.get(raw_category)
        if not category:
            category = BankActivityCategory(name=raw_category)
            db.add(category)
            db.flush()
            categories_by_name[raw_category] = category

        payee = payees_by_normalized[row["normalized_payee"]]
        if payee.id in payee_category_map:
            continue
        if len(payee_category_options[row["normalized_payee"]]) != 1:
            continue
        link = BankPayeeCategoryMap(payee_id=payee.id, category_id=category.id)
        db.add(link)
        payee_category_map[payee.id] = link

    db.flush()

    activities = []
    for row in rows:
        payee = payees_by_normalized[row["normalized_payee"]]
        activities.append(
            BankActivity(
                bank_account_id=account.id,
                import_batch_id=import_batch.id,
                activity_date=row["activity_date"],
                value_date=row["value_date"],
                description=row["description"],
                reference=row["reference"],
                payee_raw=row["payee_raw"],
                payee_id=payee.id,
                debit=row["debit"],
                credit=row["credit"],
                balance=row["balance"],
                currency=row["currency"],
                raw_category_text=row["raw_category_text"],
            )
        )

    db.add_all(activities)

    payee_ids = {payee.id for payee in payees_by_normalized.values()}
    mapped_ids = {
        payee_id
        for (payee_id,) in db.query(BankPayeeCategoryMap.payee_id)
        .filter(BankPayeeCategoryMap.payee_id.in_(payee_ids))
        .all()
    }
    unknown_payees = len(payee_ids - mapped_ids)

    db.commit()

    return BankImportSummary(
        import_id=import_batch.id,
        total_rows=len(rows),
        inserted_rows=len(activities),
        new_payees=new_payees,
        unknown_payees=unknown_payees,
    )


@router.get("", response_model=list[BankImportBatchOut])
def list_bank_imports(
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[BankImportBatchOut]:
    rows = (
        db.query(
            BankActivityImportBatch.id,
            BankActivityImportBatch.source_filename,
            BankActivityImportBatch.period_month,
            BankActivityImportBatch.uploaded_at,
            func.count(BankActivity.id).label("row_count"),
        )
        .outerjoin(BankActivity, BankActivity.import_batch_id == BankActivityImportBatch.id)
        .group_by(BankActivityImportBatch.id)
        .order_by(BankActivityImportBatch.uploaded_at.desc())
        .limit(limit)
        .all()
    )

    return [
        BankImportBatchOut(
            id=row.id,
            source_filename=row.source_filename,
            period_month=row.period_month.isoformat(),
            uploaded_at=row.uploaded_at.isoformat(),
            row_count=row.row_count,
        )
        for row in rows
    ]


@router.delete("/{import_id}")
def delete_bank_import(
    import_id: int,
    db: Session = Depends(get_db),
) -> dict:
    batch = (
        db.query(BankActivityImportBatch)
        .filter(BankActivityImportBatch.id == import_id)
        .one_or_none()
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")

    db.query(BankActivity).filter(BankActivity.import_batch_id == import_id).delete()
    db.delete(batch)
    db.commit()
    return {"status": "ok"}
