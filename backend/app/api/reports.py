from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, extract, func, or_
from sqlalchemy.orm import Session, aliased

from app.db.models import Category, Merchant, MerchantCategoryMap, Transaction
from app.db.session import get_db
from app.schemas.reports import (
    CategoryTotal,
    CategoryMonthDetail,
    CategoryMonthDetailResponse,
    CategoryDetailResponse,
    CategoryMonthMerchantsResponse,
    MerchantTotal,
    MerchantSpend,
    MerchantDetailResponse,
    MerchantMonthTotal,
    MonthlyTotal,
    MonthlyTrendResponse,
    MonthlyBreakdownItem,
    MonthlyBreakdownResponse,
    MerchantMonthListResponse,
    SummaryResponse,
    TopCategoriesResponse,
    TopMerchantsResponse,
    YearsResponse,
)

router = APIRouter()


def _year_or_default(year: Optional[int]) -> int:
    if year is None:
        return datetime.utcnow().year
    return year


@router.get("/summary", response_model=SummaryResponse)
def summary(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    db: Session = Depends(get_db),
) -> SummaryResponse:
    selected_year = _year_or_default(year)
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)

    total_spend = (
        db.query(func.coalesce(func.sum(amount_expr), 0))
        .filter(extract("year", Transaction.transaction_date) == selected_year)
        .scalar()
    )

    total_transactions = (
        db.query(func.count(Transaction.id))
        .filter(extract("year", Transaction.transaction_date) == selected_year)
        .scalar()
    )

    monthly_count = (
        db.query(func.count(func.distinct(func.date_trunc("month", Transaction.transaction_date))))
        .filter(extract("year", Transaction.transaction_date) == selected_year)
        .scalar()
    ) or 0

    average_monthly = total_spend / monthly_count if monthly_count else 0

    uncategorized_merchants = (
        db.query(func.count(func.distinct(Merchant.id)))
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .filter(MerchantCategoryMap.id.is_(None))
        .scalar()
    )

    return SummaryResponse(
        year=selected_year,
        total_spend=total_spend,
        average_monthly=average_monthly,
        total_transactions=total_transactions,
        uncategorized_merchants=uncategorized_merchants,
    )


@router.get("/top-categories", response_model=TopCategoriesResponse)
def top_categories(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    limit: int = Query(8, ge=1, le=200),
    db: Session = Depends(get_db),
) -> TopCategoriesResponse:
    selected_year = _year_or_default(year)
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    category_name = func.coalesce(Category.name, "Uncategorized")

    rows = (
        db.query(
            Category.id.label("id"),
            category_name.label("name"),
            func.sum(amount_expr).label("total"),
        )
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .filter(extract("year", Transaction.transaction_date) == selected_year)
        .group_by(Category.id, category_name)
        .order_by(func.sum(amount_expr).desc())
        .limit(limit)
        .all()
    )

    return TopCategoriesResponse(
        year=selected_year,
        items=[
            CategoryTotal(id=row.id, name=row.name, total=row.total) for row in rows
        ],
    )


@router.get("/top-merchants", response_model=TopMerchantsResponse)
def top_merchants(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    limit: int = Query(8, ge=1, le=200),
    db: Session = Depends(get_db),
) -> TopMerchantsResponse:
    selected_year = _year_or_default(year)
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    merchant_name = func.coalesce(Merchant.display_name, Transaction.merchant_raw)

    rows = (
        db.query(Merchant.id.label("id"), merchant_name.label("name"), func.sum(amount_expr).label("total"))
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .filter(extract("year", Transaction.transaction_date) == selected_year)
        .group_by(Merchant.id, merchant_name)
        .order_by(func.sum(amount_expr).desc())
        .limit(limit)
        .all()
    )

    return TopMerchantsResponse(
        year=selected_year,
        items=[MerchantTotal(id=row.id, name=row.name, total=row.total) for row in rows],
    )


@router.get("/monthly-trend", response_model=MonthlyTrendResponse)
def monthly_trend(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    db: Session = Depends(get_db),
) -> MonthlyTrendResponse:
    selected_year = _year_or_default(year)
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    month_bucket = func.date_trunc("month", Transaction.transaction_date)
    month_label = func.to_char(month_bucket, "YYYY-MM")

    rows = (
        db.query(month_label.label("month"), func.sum(amount_expr).label("total"))
        .filter(extract("year", Transaction.transaction_date) == selected_year)
        .group_by(month_bucket, month_label)
        .order_by(month_bucket)
        .all()
    )

    items = [
        MonthlyTotal(month=row.month, total=row.total) for row in rows
    ]

    return MonthlyTrendResponse(year=selected_year, items=items)


@router.get("/category-monthly", response_model=MonthlyBreakdownResponse)
def category_monthly(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    limit: int = Query(8, ge=1, le=5000),
    db: Session = Depends(get_db),
) -> MonthlyBreakdownResponse:
    selected_year = _year_or_default(year)
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    category_name = func.coalesce(Category.name, "Uncategorized")
    month_bucket = func.date_trunc("month", Transaction.transaction_date)
    month_label = func.to_char(month_bucket, "YYYY-MM")

    top_names = (
        db.query(category_name.label("name"))
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .filter(extract("year", Transaction.transaction_date) == selected_year)
        .group_by(category_name)
        .order_by(func.sum(amount_expr).desc())
        .limit(limit)
        .subquery()
    )

    rows = (
        db.query(month_label.label("month"), category_name.label("name"), func.sum(amount_expr).label("total"))
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .filter(extract("year", Transaction.transaction_date) == selected_year)
        .filter(category_name.in_(db.query(top_names.c.name)))
        .group_by(month_bucket, month_label, category_name)
        .order_by(month_bucket, category_name)
        .all()
    )

    return MonthlyBreakdownResponse(
        year=selected_year,
        items=[MonthlyBreakdownItem(month=row.month, name=row.name, total=row.total) for row in rows],
    )


@router.get("/merchant-monthly", response_model=MonthlyBreakdownResponse)
def merchant_monthly(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    limit: int = Query(8, ge=1, le=200),
    db: Session = Depends(get_db),
) -> MonthlyBreakdownResponse:
    selected_year = _year_or_default(year)
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    merchant_name = func.coalesce(Merchant.display_name, Transaction.merchant_raw)
    month_bucket = func.date_trunc("month", Transaction.transaction_date)
    month_label = func.to_char(month_bucket, "YYYY-MM")

    top_names = (
        db.query(merchant_name.label("name"))
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .filter(extract("year", Transaction.transaction_date) == selected_year)
        .group_by(merchant_name)
        .order_by(func.sum(amount_expr).desc())
        .limit(limit)
        .subquery()
    )

    rows = (
        db.query(month_label.label("month"), merchant_name.label("name"), func.sum(amount_expr).label("total"))
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .filter(extract("year", Transaction.transaction_date) == selected_year)
        .filter(merchant_name.in_(db.query(top_names.c.name)))
        .group_by(month_bucket, month_label, merchant_name)
        .order_by(month_bucket, merchant_name)
        .all()
    )

    return MonthlyBreakdownResponse(
        year=selected_year,
        items=[MonthlyBreakdownItem(month=row.month, name=row.name, total=row.total) for row in rows],
    )


@router.get("/category-month", response_model=CategoryMonthDetailResponse)
def category_month_detail(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
) -> CategoryMonthDetailResponse:
    month_start = datetime(year, month, 1)
    month_end = datetime(year + (month == 12), 1 if month == 12 else month + 1, 1)
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    manual_category = aliased(Category)
    category_name = func.coalesce(
        manual_category.name,
        Category.name,
        "Uncategorized",
    )
    merchant_id = Merchant.id
    merchant_name = func.coalesce(Merchant.display_name, Transaction.merchant_raw)

    rows = (
        db.query(
            category_name.label("category"),
            merchant_id.label("merchant_id"),
            merchant_name.label("merchant"),
            func.sum(amount_expr).label("total"),
        )
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .outerjoin(manual_category, Transaction.manual_category_id == manual_category.id)
        .filter(Transaction.transaction_date >= month_start)
        .filter(Transaction.transaction_date < month_end)
        .group_by(category_name, merchant_id, merchant_name)
        .order_by(category_name, func.sum(amount_expr).desc())
        .all()
    )

    category_map: dict[str, CategoryMonthDetail] = {}
    for row in rows:
        if row.category not in category_map:
            category_map[row.category] = CategoryMonthDetail(
                name=row.category,
                total=0,
                merchants=[],
            )
        category_entry = category_map[row.category]
        category_entry.total += row.total
        category_entry.merchants.append(
            MerchantSpend(id=row.merchant_id, name=row.merchant, total=row.total)
        )

    categories = sorted(category_map.values(), key=lambda item: item.total, reverse=True)
    month_label = f"{year:04d}-{month:02d}"

    return CategoryMonthDetailResponse(month=month_label, categories=categories)


@router.get("/merchant-detail", response_model=MerchantDetailResponse)
def merchant_detail(
    merchant_id: int = Query(..., ge=1),
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
) -> MerchantDetailResponse:
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    month_bucket = func.date_trunc("month", Transaction.transaction_date)
    month_label = func.to_char(month_bucket, "YYYY-MM")

    rows = (
        db.query(month_label.label("month"), func.sum(amount_expr).label("total"))
        .filter(Transaction.merchant_id == merchant_id)
        .filter(extract("year", Transaction.transaction_date) == year)
        .group_by(month_bucket, month_label)
        .order_by(month_bucket)
        .all()
    )

    return MerchantDetailResponse(
        merchant_id=merchant_id,
        merchant_name=merchant.display_name,
        year=year,
        items=[MerchantMonthTotal(month=row.month, total=row.total) for row in rows],
    )


@router.get("/merchant-month-list", response_model=MerchantMonthListResponse)
def merchant_month_list(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> MerchantMonthListResponse:
    month_start = datetime(year, month, 1)
    month_end = datetime(year + (month == 12), 1 if month == 12 else month + 1, 1)
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    merchant_name = func.coalesce(Merchant.display_name, Transaction.merchant_raw)

    query = (
        db.query(
            Merchant.id.label("id"),
            merchant_name.label("name"),
            func.sum(amount_expr).label("total"),
        )
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .filter(Transaction.transaction_date >= month_start)
        .filter(Transaction.transaction_date < month_end)
        .group_by(Merchant.id, merchant_name)
        .order_by(func.sum(amount_expr).desc())
    )

    if q:
        query = query.filter(merchant_name.ilike(f"%{q}%"))

    rows = query.limit(limit).offset(offset).all()
    month_label = f"{year:04d}-{month:02d}"
    return MerchantMonthListResponse(
        month=month_label,
        items=[MerchantTotal(id=row.id, name=row.name, total=row.total) for row in rows],
    )


@router.get("/category-detail", response_model=CategoryDetailResponse)
def category_detail(
    year: int = Query(..., ge=2000, le=2100),
    category_id: Optional[int] = Query(None, ge=1),
    uncategorized: bool = Query(False),
    db: Session = Depends(get_db),
) -> CategoryDetailResponse:
    if not category_id and not uncategorized:
        raise HTTPException(status_code=400, detail="category_id or uncategorized required")

    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    month_bucket = func.date_trunc("month", Transaction.transaction_date)
    month_label = func.to_char(month_bucket, "YYYY-MM")
    manual_category = aliased(Category)

    query = (
        db.query(month_label.label("month"), func.sum(amount_expr).label("total"))
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .outerjoin(manual_category, Transaction.manual_category_id == manual_category.id)
        .filter(extract("year", Transaction.transaction_date) == year)
    )

    if uncategorized:
        query = query.filter(
            Transaction.manual_category_id.is_(None),
            MerchantCategoryMap.id.is_(None),
        )
        category_name = "Uncategorized"
        resolved_id = None
    else:
        category = db.query(Category).filter(Category.id == category_id).one_or_none()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        query = query.filter(
            or_(
                Transaction.manual_category_id == category_id,
                and_(
                    Transaction.manual_category_id.is_(None),
                    MerchantCategoryMap.category_id == category_id,
                ),
            )
        )
        category_name = category.name
        resolved_id = category.id

    rows = (
        query.group_by(month_bucket, month_label)
        .order_by(month_bucket)
        .all()
    )

    return CategoryDetailResponse(
        category_id=resolved_id,
        category_name=category_name,
        year=year,
        items=[MonthlyTotal(month=row.month, total=row.total) for row in rows],
    )


@router.get("/category-month-merchants", response_model=CategoryMonthMerchantsResponse)
def category_month_merchants(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    category_id: Optional[int] = Query(None, ge=1),
    uncategorized: bool = Query(False),
    db: Session = Depends(get_db),
) -> CategoryMonthMerchantsResponse:
    if not category_id and not uncategorized:
        raise HTTPException(status_code=400, detail="category_id or uncategorized required")

    month_start = datetime(year, month, 1)
    month_end = datetime(year + (month == 12), 1 if month == 12 else month + 1, 1)
    amount_expr = func.coalesce(Transaction.charged_amount, Transaction.transaction_amount)
    manual_category = aliased(Category)
    category_name = func.coalesce(
        manual_category.name,
        Category.name,
        "Uncategorized",
    )
    merchant_id = Merchant.id
    merchant_name = func.coalesce(Merchant.display_name, Transaction.merchant_raw)

    query = (
        db.query(
            merchant_id.label("merchant_id"),
            merchant_name.label("merchant"),
            func.sum(amount_expr).label("total"),
        )
        .select_from(Transaction)
        .outerjoin(Merchant, Transaction.merchant_id == Merchant.id)
        .outerjoin(MerchantCategoryMap, Merchant.id == MerchantCategoryMap.merchant_id)
        .outerjoin(Category, MerchantCategoryMap.category_id == Category.id)
        .outerjoin(manual_category, Transaction.manual_category_id == manual_category.id)
        .filter(Transaction.transaction_date >= month_start)
        .filter(Transaction.transaction_date < month_end)
    )

    if uncategorized:
        query = query.filter(
            Transaction.manual_category_id.is_(None),
            MerchantCategoryMap.id.is_(None),
        )
        category_name = "Uncategorized"
        resolved_id = None
    else:
        category = db.query(Category).filter(Category.id == category_id).one_or_none()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        query = query.filter(
            or_(
                Transaction.manual_category_id == category_id,
                and_(
                    Transaction.manual_category_id.is_(None),
                    MerchantCategoryMap.category_id == category_id,
                ),
            )
        )
        category_name = category.name
        resolved_id = category.id

    rows = (
        query.group_by(merchant_id, merchant_name)
        .order_by(func.sum(amount_expr).desc())
        .all()
    )

    month_label = f"{year:04d}-{month:02d}"

    return CategoryMonthMerchantsResponse(
        month=month_label,
        category_id=resolved_id,
        category_name=category_name,
        merchants=[
            MerchantSpend(id=row.merchant_id, name=row.merchant, total=row.total)
            for row in rows
        ],
    )


@router.get("/years", response_model=YearsResponse)
def available_years(db: Session = Depends(get_db)) -> YearsResponse:
    rows = (
        db.query(func.extract("year", Transaction.transaction_date).label("year"))
        .distinct()
        .order_by("year")
        .all()
    )
    years = [int(row.year) for row in rows if row.year is not None]
    return YearsResponse(years=years)
