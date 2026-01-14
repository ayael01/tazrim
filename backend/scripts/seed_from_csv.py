import csv
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from app.db.session import SessionLocal  # noqa: E402
from app.db.models import Category, Merchant, MerchantCategoryMap  # noqa: E402

DEFAULT_BASE = Path("/Users/eliayash/Documents/Dev/Tazrim")
DEFAULT_CATEGORIES = DEFAULT_BASE / "categories - Sheet1.csv"
DEFAULT_BUSINESS = DEFAULT_BASE / "business-category - Sheet1.csv"


def normalize_merchant(name: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", name, flags=re.UNICODE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.casefold()


def load_categories(session, categories_path: Path) -> dict[str, Category]:
    categories_by_name: dict[str, Category] = {
        category.name: category for category in session.query(Category).all()
    }

    with categories_path.open(newline="", encoding="utf-8") as file:
        reader = csv.reader(file)
        header = next(reader, None)
        for row in reader:
            if not row:
                continue
            name = row[0].strip()
            if not name:
                continue
            if name in categories_by_name:
                continue
            category = Category(name=name)
            session.add(category)
            categories_by_name[name] = category

    return categories_by_name


def load_merchants(session, business_path: Path, categories_by_name: dict[str, Category]) -> None:
    with business_path.open(newline="", encoding="utf-8") as file:
        reader = csv.reader(file)
        header = next(reader, None)
        for row in reader:
            if len(row) < 4:
                continue
            business_name = row[0].strip()
            category_name = row[3].strip()
            if not business_name or not category_name:
                continue

            category = categories_by_name.get(category_name)
            if not category:
                category = Category(name=category_name)
                session.add(category)
                categories_by_name[category_name] = category

            normalized_name = normalize_merchant(business_name)
            merchant = (
                session.query(Merchant)
                .filter(Merchant.normalized_name == normalized_name)
                .one_or_none()
            )
            if not merchant:
                merchant = Merchant(normalized_name=normalized_name, display_name=business_name)
                session.add(merchant)
                session.flush()

            mapping = (
                session.query(MerchantCategoryMap)
                .filter(MerchantCategoryMap.merchant_id == merchant.id)
                .one_or_none()
            )
            if not mapping:
                session.add(
                    MerchantCategoryMap(merchant_id=merchant.id, category_id=category.id)
                )
            elif mapping.category_id != category.id:
                mapping.category_id = category.id


def main() -> None:
    load_dotenv()

    categories_path = DEFAULT_CATEGORIES
    business_path = DEFAULT_BUSINESS

    if not categories_path.exists() or not business_path.exists():
        raise SystemExit(
            "CSV files not found. Provide them at /Users/eliayash/Documents/Dev/Tazrim "
            "or adjust DEFAULT_* paths in scripts/seed_from_csv.py."
        )

    with SessionLocal() as session:
        categories_by_name = load_categories(session, categories_path)
        load_merchants(session, business_path, categories_by_name)
        session.commit()

    print("Seeding completed.")


if __name__ == "__main__":
    main()
