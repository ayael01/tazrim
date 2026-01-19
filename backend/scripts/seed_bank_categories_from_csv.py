import argparse
import csv
import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from app.db.models import BankActivityCategory  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed bank activity categories from CSV.")
    parser.add_argument(
        "--path",
        default=str(BASE_DIR.parent / "account_activities_categories.csv"),
        help="Path to account_activities_categories.csv",
    )
    args = parser.parse_args()

    load_dotenv()
    path = Path(args.path)
    if not path.exists():
        raise SystemExit(f"File not found: {path}")

    with SessionLocal() as session:
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                raise SystemExit("Missing headers")
            header = reader.fieldnames[0]
            names = [row.get(header, "").strip() for row in reader]
            names = [name for name in names if name]
            names = sorted(set(names))

        existing = {row.name for row in session.query(BankActivityCategory).all()}
        created = 0
        for name in names:
            if name in existing:
                continue
            session.add(BankActivityCategory(name=name))
            created += 1
        session.commit()

    print(f"Seeded {created} bank activity categories.")


if __name__ == "__main__":
    main()
