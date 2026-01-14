import argparse
import csv
import glob
import re
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from app.db.models import CardAccount, ImportBatch, Merchant, Transaction  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services.importer import parse_transactions_csv  # noqa: E402


def infer_period_month(filename: str) -> str:
    match = re.search(r"(20\d{2})", filename)
    if not match:
        raise ValueError(f"Could not infer year from filename: {filename}")
    return f"{match.group(1)}-01"


def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk import transaction CSV files.")
    parser.add_argument(
        "--path",
        default="/Users/eliayash/Projects/tazrim/transactions_202*.csv",
        help="Glob path for transaction CSV files.",
    )
    parser.add_argument(
        "--card-name",
        default="Combined",
        help="Card account name to use for all imports.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-import files even if an import batch exists for the filename.",
    )
    args = parser.parse_args()

    load_dotenv()

    files = [Path(path) for path in sorted(glob.glob(args.path))]
    if not files:
        raise SystemExit(f"No files matched: {args.path}")

    with SessionLocal() as session:
        card = session.query(CardAccount).filter(CardAccount.name == args.card_name).one_or_none()
        if not card:
            card = CardAccount(name=args.card_name)
            session.add(card)
            session.flush()

        for file_path in files:
            period_month = infer_period_month(file_path.name)
            existing_batch = (
                session.query(ImportBatch)
                .filter(
                    ImportBatch.card_account_id == card.id,
                    ImportBatch.source_filename == file_path.name,
                )
                .first()
            )
            if existing_batch and not args.force:
                print(f"Skipping {file_path.name} (already imported)")
                continue
            skip_log = []
            with file_path.open("rb") as handle:
                rows = parse_transactions_csv(
                    type("UploadFileProxy", (), {"file": handle, "filename": file_path.name})(),
                    skip_log=skip_log,
                )

            import_batch = ImportBatch(
                card_account_id=card.id,
                source_filename=file_path.name,
                period_month=datetime.strptime(period_month, "%Y-%m").date(),
            )
            session.add(import_batch)
            session.flush()

            normalized_names = {row["normalized_merchant"] for row in rows}
            existing_merchants = (
                session.query(Merchant)
                .filter(Merchant.normalized_name.in_(normalized_names))
                .all()
            )
            merchants_by_normalized = {
                merchant.normalized_name: merchant for merchant in existing_merchants
            }

            for row in rows:
                normalized_name = row["normalized_merchant"]
                if normalized_name not in merchants_by_normalized:
                    merchant = Merchant(
                        normalized_name=normalized_name,
                        display_name=row["merchant_raw"],
                    )
                    session.add(merchant)
                    merchants_by_normalized[normalized_name] = merchant

            session.flush()

            transactions = []
            for row in rows:
                merchant = merchants_by_normalized[row["normalized_merchant"]]
                transactions.append(
                    Transaction(
                        card_account_id=card.id,
                        import_batch_id=import_batch.id,
                        transaction_date=row["transaction_date"],
                        posting_date=row["posting_date"],
                        merchant_raw=row["merchant_raw"],
                        merchant_id=merchant.id,
                        transaction_amount=row["transaction_amount"],
                        transaction_currency=row["transaction_currency"],
                        charged_amount=row["charged_amount"],
                        charged_currency=row["charged_currency"],
                    )
                )

            session.add_all(transactions)
            session.commit()
            print(f"Imported {len(transactions)} rows from {file_path.name}")

            if skip_log:
                log_dir = BASE_DIR / "logs"
                log_dir.mkdir(parents=True, exist_ok=True)
                safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", file_path.stem)
                log_path = log_dir / f"skipped_{safe_name}.csv"
                with log_path.open("w", newline="", encoding="utf-8") as file:
                    writer = csv.DictWriter(
                        file,
                        fieldnames=[
                            "row_index",
                            "reason",
                            "transaction_date",
                            "posting_date",
                            "merchant",
                            "transaction_amount",
                            "charged_amount",
                        ],
                    )
                    writer.writeheader()
                    writer.writerows(skip_log)
                print(f"Wrote {len(skip_log)} skipped rows to {log_path}")


if __name__ == "__main__":
    main()
