from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel


class TransactionOut(BaseModel):
    id: int
    transaction_date: date
    posting_date: Optional[date]
    merchant_raw: str
    amount: Decimal
    currency: str
    charged_amount: Optional[Decimal]
    charged_currency: Optional[str]
    manual_category_id: Optional[int]
    category_id: Optional[int]
    category_name: Optional[str]


class TransactionList(BaseModel):
    total: int
    items: list[TransactionOut]


class TransactionMonthList(BaseModel):
    month: str
    items: list[TransactionOut]


class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None


class TransactionsExportRequest(BaseModel):
    scope: Literal["filtered", "all"] = "filtered"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    q: Optional[str] = None
    category_id: Optional[int] = None
    currency_mode: Literal["charged", "original", "both"] = "charged"
    filename: Optional[str] = None
    include_summary: bool = True
    include_monthly_trend: bool = True
    include_by_category: bool = True
    include_by_merchant: bool = True
    include_billing_cycle: bool = True
    include_exceptions: bool = True
    columns: list[str] = [
        "transaction_date",
        "posting_date",
        "merchant_raw",
        "merchant_display",
        "category",
        "manual_override",
        "transaction_amount",
        "transaction_currency",
        "charged_amount",
        "charged_currency",
        "card_account",
        "source_filename",
        "transaction_id",
    ]
