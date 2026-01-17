from typing import Optional

from pydantic import BaseModel


class ImportSummary(BaseModel):
    import_id: int
    total_rows: int
    inserted_rows: int
    new_merchants: int
    unknown_merchants: int


class ImportBatchOut(BaseModel):
    id: int
    source_filename: Optional[str]
    period_month: str
    uploaded_at: str
    row_count: int
