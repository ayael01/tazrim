from decimal import Decimal

from pydantic import BaseModel


class UnknownMerchant(BaseModel):
    id: int
    display_name: str
    normalized_name: str
    transaction_count: int


class MerchantSearchResult(BaseModel):
    id: int
    name: str
    total: Decimal
