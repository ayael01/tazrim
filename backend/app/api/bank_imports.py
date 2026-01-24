from collections import defaultdict
from collections import defaultdict
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    BankAccount,
    BankActivity,
    BankActivityCategory,
    BankActivityImportDraft,
    BankActivityImportDraftRow,
    BankActivityImportBatch,
    BankPayee,
    BankPayeeCategoryMap,
)
from app.db.session import get_db
from app.schemas.bank import (
    BankImportBatchOut,
    BankImportDraftDetail,
    BankImportDraftOut,
    BankImportDraftRowOut,
    BankImportSummary,
)
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


@router.post("/drafts", response_model=BankImportDraftOut)
def create_bank_import_draft(
    period_month: str = Form(...),
    account_name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> BankImportDraftOut:
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

    normalized_names = {row["normalized_payee"] for row in rows}
    existing_payees = (
        db.query(BankPayee)
        .filter(BankPayee.normalized_name.in_(normalized_names))
        .all()
    )
    payees_by_normalized = {payee.normalized_name: payee for payee in existing_payees}

    payee_category_map = {
        link.payee_id: link
        for link in db.query(BankPayeeCategoryMap).all()
    }
    categories_by_id = {
        category.id: category
        for category in db.query(BankActivityCategory).all()
    }

    draft = BankActivityImportDraft(
        bank_account_id=account.id,
        source_filename=file.filename,
        period_month=month,
        row_count=len(rows),
        status="pending",
    )
    db.add(draft)
    db.flush()

    draft_rows = []
    for row_index, row in enumerate(rows, start=2):
        normalized_name = row["normalized_payee"]
        suggested = row.get("raw_category_text")
        payee = payees_by_normalized.get(normalized_name)
        if not suggested and payee and payee.id in payee_category_map:
            category = categories_by_id.get(payee_category_map[payee.id].category_id)
            suggested = category.name if category else None

        draft_rows.append(
            BankActivityImportDraftRow(
                draft_id=draft.id,
                row_index=row_index,
                activity_date=row["activity_date"],
                value_date=row["value_date"],
                description=row["description"],
                reference=row["reference"],
                payee_raw=row["payee_raw"],
                normalized_payee=normalized_name,
                debit=row["debit"],
                credit=row["credit"],
                balance=row["balance"],
                currency=row["currency"],
                raw_category_text=row.get("raw_category_text"),
                suggested_category_text=suggested,
                approved_category_text=None,
            )
        )

    db.add_all(draft_rows)
    db.commit()

    return BankImportDraftOut(
        id=draft.id,
        source_filename=draft.source_filename,
        period_month=draft.period_month.isoformat(),
        status=draft.status,
        row_count=draft.row_count or 0,
        created_at=draft.created_at.isoformat(),
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


@router.get("/drafts", response_model=list[BankImportDraftOut])
def list_bank_import_drafts(
    limit: int = Query(20, ge=1, le=200),
    status: str = Query("pending", pattern="^(pending|committed|discarded)$"),
    db: Session = Depends(get_db),
) -> list[BankImportDraftOut]:
    rows = (
        db.query(BankActivityImportDraft)
        .filter(BankActivityImportDraft.status == status)
        .order_by(BankActivityImportDraft.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        BankImportDraftOut(
            id=row.id,
            source_filename=row.source_filename,
            period_month=row.period_month.isoformat(),
            status=row.status,
            row_count=row.row_count or 0,
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]


@router.get("/drafts/{draft_id}", response_model=BankImportDraftDetail)
def get_bank_import_draft(
    draft_id: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> BankImportDraftDetail:
    draft = (
        db.query(BankActivityImportDraft)
        .filter(BankActivityImportDraft.id == draft_id)
        .one_or_none()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    total_rows = (
        db.query(func.count(BankActivityImportDraftRow.id))
        .filter(BankActivityImportDraftRow.draft_id == draft_id)
        .scalar()
    ) or 0

    rows = (
        db.query(BankActivityImportDraftRow)
        .filter(BankActivityImportDraftRow.draft_id == draft_id)
        .order_by(BankActivityImportDraftRow.row_index)
        .limit(limit)
        .offset(offset)
        .all()
    )

    return BankImportDraftDetail(
        draft=BankImportDraftOut(
            id=draft.id,
            source_filename=draft.source_filename,
            period_month=draft.period_month.isoformat(),
            status=draft.status,
            row_count=draft.row_count or 0,
            created_at=draft.created_at.isoformat(),
        ),
        rows=[
            BankImportDraftRowOut(
                id=row.id,
                row_index=row.row_index,
                activity_date=row.activity_date.isoformat(),
                value_date=row.value_date.isoformat() if row.value_date else None,
                description=row.description,
                reference=row.reference,
                debit=row.debit,
                credit=row.credit,
                balance=row.balance,
                currency=row.currency,
                payee_raw=row.payee_raw,
                raw_category_text=row.raw_category_text,
                suggested_category_text=row.suggested_category_text,
                approved_category_text=row.approved_category_text,
            )
            for row in rows
        ],
        total_rows=total_rows,
    )


@router.patch("/drafts/{draft_id}/rows/{row_id}", response_model=BankImportDraftRowOut)
def update_bank_import_draft_row(
    draft_id: int,
    row_id: int,
    approved_category_text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
) -> BankImportDraftRowOut:
    row = (
        db.query(BankActivityImportDraftRow)
        .filter(
            BankActivityImportDraftRow.id == row_id,
            BankActivityImportDraftRow.draft_id == draft_id,
        )
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Draft row not found")

    row.approved_category_text = approved_category_text or None
    db.commit()

    return BankImportDraftRowOut(
        id=row.id,
        row_index=row.row_index,
        activity_date=row.activity_date.isoformat(),
        value_date=row.value_date.isoformat() if row.value_date else None,
        description=row.description,
        reference=row.reference,
        debit=row.debit,
        credit=row.credit,
        balance=row.balance,
        currency=row.currency,
        payee_raw=row.payee_raw,
        raw_category_text=row.raw_category_text,
        suggested_category_text=row.suggested_category_text,
        approved_category_text=row.approved_category_text,
    )


@router.post("/drafts/{draft_id}/commit", response_model=BankImportSummary)
def commit_bank_import_draft(
    draft_id: int,
    db: Session = Depends(get_db),
) -> BankImportSummary:
    draft = (
        db.query(BankActivityImportDraft)
        .filter(BankActivityImportDraft.id == draft_id)
        .one_or_none()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status != "pending":
        raise HTTPException(status_code=400, detail="Draft is not pending")

    rows = (
        db.query(BankActivityImportDraftRow)
        .filter(BankActivityImportDraftRow.draft_id == draft_id)
        .order_by(BankActivityImportDraftRow.row_index)
        .all()
    )

    account = (
        db.query(BankAccount).filter(BankAccount.id == draft.bank_account_id).one()
    )

    import_batch = BankActivityImportBatch(
        bank_account_id=account.id,
        source_filename=draft.source_filename,
        period_month=draft.period_month,
        row_count=len(rows),
    )
    db.add(import_batch)
    db.flush()

    normalized_names = {row.normalized_payee for row in rows}
    existing_payees = (
        db.query(BankPayee)
        .filter(BankPayee.normalized_name.in_(normalized_names))
        .all()
    )
    payees_by_normalized = {payee.normalized_name: payee for payee in existing_payees}

    new_payees = 0
    for row in rows:
        normalized_name = row.normalized_payee
        if normalized_name not in payees_by_normalized:
            payee = BankPayee(
                normalized_name=normalized_name,
                display_name=row.payee_raw,
            )
            db.add(payee)
            payees_by_normalized[normalized_name] = payee
            new_payees += 1

    db.flush()

    categories_by_name = {
        category.name: category
        for category in db.query(BankActivityCategory).all()
    }

    final_categories_by_payee = defaultdict(set)
    activities = []
    for row in rows:
        category_name = (
            row.approved_category_text
            or row.suggested_category_text
            or row.raw_category_text
        )
        if category_name and category_name.strip().casefold() == "uncategorized":
            category_name = None
        if category_name and category_name not in categories_by_name:
            category = BankActivityCategory(name=category_name)
            db.add(category)
            db.flush()
            categories_by_name[category_name] = category

        payee = payees_by_normalized[row.normalized_payee]
        if category_name:
            final_categories_by_payee[payee.id].add(category_name)

        activities.append(
            BankActivity(
                bank_account_id=account.id,
                import_batch_id=import_batch.id,
                activity_date=row.activity_date,
                value_date=row.value_date,
                description=row.description,
                reference=row.reference,
                payee_raw=row.payee_raw,
                payee_id=payee.id,
                debit=row.debit,
                credit=row.credit,
                balance=row.balance,
                currency=row.currency,
                raw_category_text=category_name,
            )
        )

    db.add_all(activities)
    db.flush()

    payee_category_map = {
        link.payee_id: link
        for link in db.query(BankPayeeCategoryMap).all()
    }
    for payee_id, categories in final_categories_by_payee.items():
        if payee_id in payee_category_map:
            continue
        if len(categories) != 1:
            continue
        category_name = next(iter(categories))
        category = categories_by_name.get(category_name)
        if not category:
            continue
        link = BankPayeeCategoryMap(payee_id=payee_id, category_id=category.id)
        db.add(link)

    draft.status = "committed"
    db.commit()

    unknown_payees = (
        db.query(func.count(func.distinct(BankPayee.id)))
        .outerjoin(BankPayeeCategoryMap, BankPayee.id == BankPayeeCategoryMap.payee_id)
        .filter(BankPayeeCategoryMap.id.is_(None))
        .scalar()
    )

    return BankImportSummary(
        import_id=import_batch.id,
        total_rows=len(rows),
        inserted_rows=len(activities),
        new_payees=new_payees,
        unknown_payees=unknown_payees,
    )


@router.delete("/drafts/{draft_id}")
def delete_bank_import_draft(
    draft_id: int,
    db: Session = Depends(get_db),
) -> dict:
    draft = (
        db.query(BankActivityImportDraft)
        .filter(BankActivityImportDraft.id == draft_id)
        .one_or_none()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status != "pending":
        raise HTTPException(status_code=400, detail="Draft is not pending")
    db.delete(draft)
    db.commit()
    return {"status": "ok"}


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
