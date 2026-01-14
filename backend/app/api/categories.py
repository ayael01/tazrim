from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import Category
from app.db.session import get_db
from app.schemas.categories import CategoryOut

router = APIRouter()


@router.get("", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db)) -> List[CategoryOut]:
    categories = db.query(Category).order_by(Category.name).all()
    return [CategoryOut(id=cat.id, name=cat.name) for cat in categories]
