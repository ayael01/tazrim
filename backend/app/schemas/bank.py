from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class BankCategoryOut(BaseModel):
    id: Optional[int]
    name: str
    total: Optional[Decimal] = None


class BankPayeeOut(BaseModel):
    id: int
    name: str
    total: Decimal


class BankUnknownPayee(BaseModel):
    id: int
    display_name: str
    normalized_name: str
    activity_count: int


class BankPayeeSpend(BaseModel):
    id: Optional[int]
    name: str
    total: Decimal


class BankActivityOut(BaseModel):
    id: int
    activity_date: str
    value_date: Optional[str]
    description: str
    reference: Optional[str]
    debit: Optional[Decimal]
    credit: Optional[Decimal]
    balance: Optional[Decimal]
    currency: Optional[str]
    payee_name: Optional[str]
    category_id: Optional[int]
    category_name: Optional[str]


class BankActivityUpdate(BaseModel):
    category_id: Optional[int] = None


class BankActivityList(BaseModel):
    total: int
    items: List[BankActivityOut]


class BankImportBatchOut(BaseModel):
    id: int
    source_filename: Optional[str]
    period_month: str
    uploaded_at: str
    row_count: int


class BankImportSummary(BaseModel):
    import_id: int
    total_rows: int
    inserted_rows: int
    new_payees: int
    unknown_payees: int


class BankImportDraftOut(BaseModel):
    id: int
    source_filename: Optional[str]
    period_month: str
    status: str
    row_count: int
    created_at: str


class BankImportDraftRowOut(BaseModel):
    id: int
    row_index: int
    activity_date: str
    value_date: Optional[str]
    description: str
    reference: Optional[str]
    debit: Optional[Decimal]
    credit: Optional[Decimal]
    balance: Optional[Decimal]
    currency: Optional[str]
    payee_raw: str
    raw_category_text: Optional[str]
    suggested_category_text: Optional[str]
    approved_category_text: Optional[str]


class BankImportDraftDetail(BaseModel):
    draft: BankImportDraftOut
    rows: List[BankImportDraftRowOut]
    total_rows: int


class BankSummaryResponse(BaseModel):
    year: int
    income_total: Decimal
    expense_total: Decimal
    net_total: Decimal
    average_monthly_income: Decimal
    average_monthly_expense: Decimal
    total_activities: int
    uncategorized_payees: int


class BankMonthlyTotal(BaseModel):
    month: str
    total: Decimal


class BankMonthlyTrendResponse(BaseModel):
    year: int
    items: List[BankMonthlyTotal]


class BankMonthlyCashflowItem(BaseModel):
    month: str
    income: Decimal
    expense: Decimal
    net: Decimal


class BankMonthlyCashflowResponse(BaseModel):
    year: int
    items: List[BankMonthlyCashflowItem]


class BankMonthlyBreakdownItem(BaseModel):
    month: str
    name: str
    total: Decimal


class BankMonthlyBreakdownResponse(BaseModel):
    year: int
    items: List[BankMonthlyBreakdownItem]


class BankCategoryMonthDetail(BaseModel):
    name: str
    total: Decimal
    payees: List[BankPayeeSpend]


class BankCategoryMonthDetailResponse(BaseModel):
    month: str
    categories: List[BankCategoryMonthDetail]


class BankYearsResponse(BaseModel):
    years: List[int]
