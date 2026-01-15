from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class SummaryResponse(BaseModel):
    year: int
    total_spend: Decimal
    average_monthly: Decimal
    total_transactions: int
    uncategorized_merchants: int


class CategoryTotal(BaseModel):
    id: Optional[int]
    name: str
    total: Decimal


class MerchantTotal(BaseModel):
    id: int
    name: str
    total: Decimal


class MonthlyTotal(BaseModel):
    month: str
    total: Decimal


class TopCategoriesResponse(BaseModel):
    year: int
    items: List[CategoryTotal]


class TopMerchantsResponse(BaseModel):
    year: int
    items: List[MerchantTotal]


class MonthlyTrendResponse(BaseModel):
    year: int
    items: List[MonthlyTotal]


class YearsResponse(BaseModel):
    years: List[int]


class MonthlyBreakdownItem(BaseModel):
    month: str
    name: str
    total: Decimal


class MonthlyBreakdownResponse(BaseModel):
    year: int
    items: List[MonthlyBreakdownItem]


class MerchantSpend(BaseModel):
    name: str
    total: Decimal


class CategoryMonthDetail(BaseModel):
    name: str
    total: Decimal
    merchants: List[MerchantSpend]


class CategoryMonthDetailResponse(BaseModel):
    month: str
    categories: List[CategoryMonthDetail]


class MerchantMonthTotal(BaseModel):
    month: str
    total: Decimal


class MerchantDetailResponse(BaseModel):
    merchant_id: int
    merchant_name: str
    year: int
    items: List[MerchantMonthTotal]


class CategoryDetailResponse(BaseModel):
    category_id: Optional[int]
    category_name: str
    year: int
    items: List[MonthlyTotal]


class CategoryMonthMerchantsResponse(BaseModel):
    month: str
    category_id: Optional[int]
    category_name: str
    merchants: List[MerchantSpend]
