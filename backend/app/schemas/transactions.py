from datetime import date
from decimal import Decimal
from typing import Optional

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
