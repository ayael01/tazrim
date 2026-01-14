from pydantic import BaseModel


class ImportSummary(BaseModel):
    import_id: int
    total_rows: int
    inserted_rows: int
    new_merchants: int
    unknown_merchants: int
