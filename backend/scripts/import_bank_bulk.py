import argparse
import csv
import glob
import re
import sys
from datetime import datetime
from pathlib import Path
from collections import defaultdict

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from app.db.models import (  # noqa: E402
    BankAccount,
    BankActivity,
    BankActivityCategory,
    BankActivityImportBatch,
    BankPayee,
    BankPayeeCategoryMap,
)
from app.db.session import SessionLocal  # noqa: E402
from app.services.bank_importer import parse_bank_activities_csv  # noqa: E402


def infer_period_month(filename: str) -> str:
    match = re.search(r"(20\d{2})", filename)
    if not match:
        raise ValueError(f"Could not infer year from filename: {filename}")
    return f"{match.group(1)}-01"


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk import bank activity CSV files.")
    parser.add_argument(
        "--path",
        default="/Users/eliayash/Projects/tazrim/mizrahi_account_activities_*.csv",
        help="Glob path for bank activity CSV files.",
    )
    parser.add_argument(
        "--account-name",
        default="Mizrahi Checking",
        help="Bank account name to use for all imports.",
    )
    parser.add_argument(
        "--bank-name",
        default="Mizrahi",
        help="Bank name for the account.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-import files even if an import batch exists for the filename.",
    )
    parser.add_argument(
        "--period-month",
        help="Override period month for all imports (YYYY-MM).",
    )
    args = parser.parse_args()

    load_dotenv()

    files = [Path(path) for path in sorted(glob.glob(args.path))]
    if not files:
        raise SystemExit(f"No files matched: {args.path}")

    with SessionLocal() as session:
        account = (
            session.query(BankAccount)
            .filter(BankAccount.name == args.account_name)
            .one_or_none()
        )
        if not account:
            account = BankAccount(name=args.account_name, bank_name=args.bank_name)
            session.add(account)
            session.flush()

        categories_by_name = {
            category.name: category
            for category in session.query(BankActivityCategory).all()
        }

        for file_path in files:
            period_month = args.period_month or infer_period_month(file_path.name)
            existing_batch = (
                session.query(BankActivityImportBatch)
                .filter(
                    BankActivityImportBatch.bank_account_id == account.id,
                    BankActivityImportBatch.source_filename == file_path.name,
                )
                .first()
            )
            if existing_batch and not args.force:
                print(f"Skipping {file_path.name} (already imported)")
                continue

            skip_log = []
            with file_path.open("rb") as handle:
                rows = parse_bank_activities_csv(
                    type("UploadFileProxy", (), {"file": handle, "filename": file_path.name})(),
                    skip_log=skip_log,
                )

            import_batch = BankActivityImportBatch(
                bank_account_id=account.id,
                source_filename=file_path.name,
                period_month=datetime.strptime(period_month, "%Y-%m").date(),
                row_count=len(rows),
            )
            session.add(import_batch)
            session.flush()

            normalized_names = {row["normalized_payee"] for row in rows}
            existing_payees = (
                session.query(BankPayee)
                .filter(BankPayee.normalized_name.in_(normalized_names))
                .all()
            )
            payees_by_normalized = {
                payee.normalized_name: payee for payee in existing_payees
            }

            for row in rows:
                normalized_name = row["normalized_payee"]
                if normalized_name not in payees_by_normalized:
                    payee = BankPayee(
                        normalized_name=normalized_name,
                        display_name=row["payee_raw"],
                    )
                    session.add(payee)
                    payees_by_normalized[normalized_name] = payee

            session.flush()

            payee_category_map = {
                link.payee_id: link
                for link in session.query(BankPayeeCategoryMap).all()
            }
            payee_category_options = defaultdict(set)
            for row in rows:
                raw_category = row.get("raw_category_text")
                if not raw_category:
                    continue
                payee_category_options[row["normalized_payee"]].add(raw_category)

            for row in rows:
                raw_category = row.get("raw_category_text")
                if not raw_category:
                    continue
                category = categories_by_name.get(raw_category)
                if not category:
                    category = BankActivityCategory(name=raw_category)
                    session.add(category)
                    session.flush()
                    categories_by_name[raw_category] = category

                payee = payees_by_normalized[row["normalized_payee"]]
                if payee.id in payee_category_map:
                    continue
                if len(payee_category_options[row["normalized_payee"]]) != 1:
                    continue
                link = BankPayeeCategoryMap(
                    payee_id=payee.id,
                    category_id=category.id,
                )
                session.add(link)
                payee_category_map[payee.id] = link

            session.flush()

            activities = []
            for row in rows:
                payee = payees_by_normalized[row["normalized_payee"]]
                activities.append(
                    BankActivity(
                        bank_account_id=account.id,
                        import_batch_id=import_batch.id,
                        activity_date=row["activity_date"],
                        value_date=row["value_date"],
                        description=row["description"],
                        reference=row["reference"],
                        payee_raw=row["payee_raw"],
                        payee_id=payee.id,
                        debit=row["debit"],
                        credit=row["credit"],
                        balance=row["balance"],
                        currency=row["currency"],
                        raw_category_text=row["raw_category_text"],
                    )
                )

            session.add_all(activities)
            session.commit()
            print(f"Imported {len(activities)} rows from {file_path.name}")

            if skip_log:
                log_dir = BASE_DIR / "logs"
                log_dir.mkdir(parents=True, exist_ok=True)
                safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", file_path.stem)
                log_path = log_dir / f"skipped_bank_{safe_name}.csv"
                with log_path.open("w", newline="", encoding="utf-8") as file:
                    writer = csv.DictWriter(
                        file,
                        fieldnames=[
                            "row_index",
                            "reason",
                            "activity_date",
                            "description",
                            "reference",
                            "debit",
                            "credit",
                            "balance",
                            "raw_category_text",
                        ],
                    )
                    writer.writeheader()
                    writer.writerows(skip_log)
                print(f"Wrote {len(skip_log)} skipped rows to {log_path}")


if __name__ == "__main__":
    main()
