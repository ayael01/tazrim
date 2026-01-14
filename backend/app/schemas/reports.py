from decimal import Decimal
from typing import List

from pydantic import BaseModel


class SummaryResponse(BaseModel):
    year: int
    total_spend: Decimal
    average_monthly: Decimal
    total_transactions: int
    uncategorized_merchants: int


class CategoryTotal(BaseModel):
    name: str
    total: Decimal


class MerchantTotal(BaseModel):
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
