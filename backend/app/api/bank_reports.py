from datetime import datetime
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
from app.schemas.bank import (
    BankCategoryMonthDetail,
    BankCategoryMonthDetailResponse,
    BankMonthlyBreakdownItem,
    BankMonthlyBreakdownResponse,
    BankMonthlyCashflowItem,
    BankMonthlyCashflowResponse,
    BankMonthlyTotal,
    BankMonthlyTrendResponse,
    BankPayeeSpend,
    BankSummaryResponse,
    BankYearsResponse,
)

router = APIRouter()


def _year_or_default(year: Optional[int], db: Session) -> int:
    if year:
        return year
    latest = db.query(func.max(func.extract("year", BankActivity.activity_date))).scalar()
    if not latest:
        return datetime.now().year
    return int(latest)


@router.get("/years", response_model=BankYearsResponse)
def available_years(db: Session = Depends(get_db)) -> BankYearsResponse:
    rows = (
        db.query(func.extract("year", BankActivity.activity_date).label("year"))
        .distinct()
        .order_by("year")
        .all()
    )
    years = [int(row.year) for row in rows if row.year is not None]
    return BankYearsResponse(years=years)


@router.get("/summary", response_model=BankSummaryResponse)
def summary(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    db: Session = Depends(get_db),
) -> BankSummaryResponse:
    selected_year = _year_or_default(year, db)
    income_expr = func.coalesce(BankActivity.credit, 0)
    expense_expr = func.coalesce(BankActivity.debit, 0)

    income_total = (
        db.query(func.coalesce(func.sum(income_expr), 0))
        .filter(func.extract("year", BankActivity.activity_date) == selected_year)
        .scalar()
    )

    expense_total = (
        db.query(func.coalesce(func.sum(expense_expr), 0))
        .filter(func.extract("year", BankActivity.activity_date) == selected_year)
        .scalar()
    )

    total_activities = (
        db.query(func.count(BankActivity.id))
        .filter(func.extract("year", BankActivity.activity_date) == selected_year)
        .scalar()
    )

    monthly_count = (
        db.query(
            func.count(func.distinct(func.date_trunc("month", BankActivity.activity_date)))
        )
        .filter(func.extract("year", BankActivity.activity_date) == selected_year)
        .scalar()
    ) or 0

    average_monthly_income = income_total / monthly_count if monthly_count else 0
    average_monthly_expense = expense_total / monthly_count if monthly_count else 0

    uncategorized_payees = (
        db.query(func.count(func.distinct(BankPayee.id)))
        .outerjoin(BankPayeeCategoryMap, BankPayee.id == BankPayeeCategoryMap.payee_id)
        .filter(BankPayeeCategoryMap.id.is_(None))
        .scalar()
    )

    return BankSummaryResponse(
        year=selected_year,
        income_total=income_total,
        expense_total=expense_total,
        net_total=income_total - expense_total,
        average_monthly_income=average_monthly_income,
        average_monthly_expense=average_monthly_expense,
        total_activities=total_activities,
        uncategorized_payees=uncategorized_payees,
    )


@router.get("/monthly-trend", response_model=BankMonthlyTrendResponse)
def monthly_trend(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    db: Session = Depends(get_db),
) -> BankMonthlyTrendResponse:
    selected_year = _year_or_default(year, db)
    amount_expr = func.coalesce(BankActivity.debit, BankActivity.credit, 0)
    month_bucket = func.date_trunc("month", BankActivity.activity_date)
    month_label = func.to_char(month_bucket, "YYYY-MM")

    rows = (
        db.query(month_label.label("month"), func.sum(amount_expr).label("total"))
        .filter(func.extract("year", BankActivity.activity_date) == selected_year)
        .group_by(month_bucket, month_label)
        .order_by(month_bucket)
        .all()
    )

    items = [BankMonthlyTotal(month=row.month, total=row.total) for row in rows]
    return BankMonthlyTrendResponse(year=selected_year, items=items)


@router.get("/monthly-cashflow", response_model=BankMonthlyCashflowResponse)
def monthly_cashflow(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    db: Session = Depends(get_db),
) -> BankMonthlyCashflowResponse:
    selected_year = _year_or_default(year, db)
    income_expr = func.coalesce(BankActivity.credit, 0)
    expense_expr = func.coalesce(BankActivity.debit, 0)
    month_bucket = func.date_trunc("month", BankActivity.activity_date)
    month_label = func.to_char(month_bucket, "YYYY-MM")

    rows = (
        db.query(
            month_label.label("month"),
            func.sum(income_expr).label("income"),
            func.sum(expense_expr).label("expense"),
        )
        .filter(func.extract("year", BankActivity.activity_date) == selected_year)
        .group_by(month_bucket, month_label)
        .order_by(month_bucket)
        .all()
    )

    items = [
        BankMonthlyCashflowItem(
            month=row.month,
            income=row.income or 0,
            expense=row.expense or 0,
            net=(row.income or 0) - (row.expense or 0),
        )
        for row in rows
    ]

    return BankMonthlyCashflowResponse(year=selected_year, items=items)


@router.get("/category-monthly", response_model=BankMonthlyBreakdownResponse)
def category_monthly(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    limit: int = Query(8, ge=1, le=200),
    direction: str = Query("expense", pattern="^(income|expense)$"),
    db: Session = Depends(get_db),
) -> BankMonthlyBreakdownResponse:
    rows = _category_monthly_rows(db, year, direction, limit=limit)
    selected_year = _year_or_default(year, db)
    return BankMonthlyBreakdownResponse(
        year=selected_year,
        items=[
            BankMonthlyBreakdownItem(month=row.month, name=row.name, total=row.total)
            for row in rows
        ],
    )


@router.get("/category-monthly-all", response_model=BankMonthlyBreakdownResponse)
def category_monthly_all(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    direction: str = Query("expense", pattern="^(income|expense)$"),
    db: Session = Depends(get_db),
) -> BankMonthlyBreakdownResponse:
    rows = _category_monthly_rows(db, year, direction, limit=None)
    selected_year = _year_or_default(year, db)
    return BankMonthlyBreakdownResponse(
        year=selected_year,
        items=[
            BankMonthlyBreakdownItem(month=row.month, name=row.name, total=row.total)
            for row in rows
        ],
    )


def _category_monthly_rows(
    db: Session,
    year: Optional[int],
    direction: str,
    limit: Optional[int],
):
    selected_year = _year_or_default(year, db)
    amount_expr = (
        func.coalesce(BankActivity.credit, 0)
        if direction == "income"
        else func.coalesce(BankActivity.debit, 0)
    )
    category_name = func.coalesce(
        BankActivity.raw_category_text, BankActivityCategory.name, "Uncategorized"
    )
    month_bucket = func.date_trunc("month", BankActivity.activity_date)
    month_label = func.to_char(month_bucket, "YYYY-MM")

    top_names = None
    if limit is not None:
        top_names = (
            db.query(category_name.label("name"))
            .select_from(BankActivity)
            .outerjoin(BankPayee, BankActivity.payee_id == BankPayee.id)
            .outerjoin(
                BankPayeeCategoryMap, BankPayee.id == BankPayeeCategoryMap.payee_id
            )
            .outerjoin(
                BankActivityCategory,
                BankPayeeCategoryMap.category_id == BankActivityCategory.id,
            )
            .filter(func.extract("year", BankActivity.activity_date) == selected_year)
            .filter(amount_expr > 0)
            .group_by(category_name)
            .order_by(func.sum(amount_expr).desc())
            .limit(limit)
            .subquery()
        )

    query = (
        db.query(
            month_label.label("month"),
            category_name.label("name"),
            func.sum(amount_expr).label("total"),
        )
        .select_from(BankActivity)
        .outerjoin(BankPayee, BankActivity.payee_id == BankPayee.id)
        .outerjoin(BankPayeeCategoryMap, BankPayee.id == BankPayeeCategoryMap.payee_id)
        .outerjoin(
            BankActivityCategory,
            BankPayeeCategoryMap.category_id == BankActivityCategory.id,
        )
        .filter(func.extract("year", BankActivity.activity_date) == selected_year)
        .filter(amount_expr > 0)
    )
    if top_names is not None:
        query = query.filter(category_name.in_(db.query(top_names.c.name)))
    return (
        query.group_by(month_bucket, month_label, category_name)
        .order_by(month_bucket, category_name)
        .all()
    )


@router.get("/category-month", response_model=BankCategoryMonthDetailResponse)
def category_month_detail(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    direction: str = Query("expense", pattern="^(income|expense)$"),
    db: Session = Depends(get_db),
) -> BankCategoryMonthDetailResponse:
    month_start = datetime(year, month, 1)
    month_end = datetime(year + (month == 12), 1 if month == 12 else month + 1, 1)
    amount_expr = (
        func.coalesce(BankActivity.credit, 0)
        if direction == "income"
        else func.coalesce(BankActivity.debit, 0)
    )
    category_name = func.coalesce(
        BankActivity.raw_category_text, BankActivityCategory.name, "Uncategorized"
    )
    payee_id = BankPayee.id
    payee_name = func.coalesce(BankPayee.display_name, BankActivity.payee_raw)

    rows = (
        db.query(
            category_name.label("category"),
            payee_id.label("payee_id"),
            payee_name.label("payee"),
            func.sum(amount_expr).label("total"),
        )
        .select_from(BankActivity)
        .outerjoin(BankPayee, BankActivity.payee_id == BankPayee.id)
        .outerjoin(BankPayeeCategoryMap, BankPayee.id == BankPayeeCategoryMap.payee_id)
        .outerjoin(
            BankActivityCategory,
            BankPayeeCategoryMap.category_id == BankActivityCategory.id,
        )
        .filter(BankActivity.activity_date >= month_start)
        .filter(BankActivity.activity_date < month_end)
        .filter(amount_expr > 0)
        .group_by(category_name, payee_id, payee_name)
        .order_by(category_name, func.sum(amount_expr).desc())
        .all()
    )

    category_map: dict[str, BankCategoryMonthDetail] = {}
    for row in rows:
        if row.category not in category_map:
            category_map[row.category] = BankCategoryMonthDetail(
                name=row.category,
                total=0,
                payees=[],
            )
        category_entry = category_map[row.category]
        category_entry.total += row.total
        category_entry.payees.append(
            BankPayeeSpend(id=row.payee_id, name=row.payee, total=row.total)
        )

    categories = sorted(category_map.values(), key=lambda item: item.total, reverse=True)
    month_label = f"{year:04d}-{month:02d}"

    return BankCategoryMonthDetailResponse(month=month_label, categories=categories)
