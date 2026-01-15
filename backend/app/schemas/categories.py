from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: Optional[int]
    name: str
    total: Optional[Decimal] = None
