import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional

from fastapi import UploadFile

CURRENCY_MAP = {
    "₪": "ILS",
    "$": "USD",
    "£": "GBP",
    "€": "EUR",
}

DATE_FORMATS = ("%d/%m/%Y", "%d/%m/%y", "%m/%d/%Y", "%m/%d/%y")


def normalize_merchant(name: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", name, flags=re.UNICODE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.casefold()


def parse_date(value: str, formats: tuple[str, ...] = DATE_FORMATS) -> date:
    value = value.strip()
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unsupported date format: {value}")


def try_parse_date(value: str, formats: tuple[str, ...] = DATE_FORMATS) -> Optional[date]:
    if not value:
        return None
    try:
        return parse_date(value, formats=formats)
    except ValueError:
        return None


def detect_date_order(values: list[str]) -> str:
    first_gt12 = 0
    second_gt12 = 0
    for value in values:
        if not value:
            continue
        parts = value.strip().split("/")
        if len(parts) < 3:
            continue
        try:
            first = int(parts[0])
            second = int(parts[1])
        except ValueError:
            continue
        if first > 12:
            first_gt12 += 1
        if second > 12:
            second_gt12 += 1
    if first_gt12:
        return "dmy"
    if second_gt12:
        return "mdy"
    return "dmy"


def formats_for_order(order: str) -> tuple[str, ...]:
    if order == "mdy":
        return ("%m/%d/%Y", "%m/%d/%y")
    return ("%d/%m/%Y", "%d/%m/%y")


def parse_money(value: str) -> tuple[Decimal, str]:
    raw = value.strip()
    if not raw:
        raise ValueError("Empty amount")

    currency = None
    for symbol, code in CURRENCY_MAP.items():
        if symbol in raw:
            currency = code
            raw = raw.replace(symbol, "")
            break

    if currency is None:
        code_match = re.search(r"\b([A-Z]{3})\b", raw)
        if code_match:
            currency = code_match.group(1)
            raw = re.sub(r"\b[A-Z]{3}\b", "", raw)

    raw = raw.replace(",", "").replace(" ", "").strip()
    if not raw:
        raise ValueError("Amount missing after normalization")

    if currency is None:
        currency = "ILS"

    try:
        amount = Decimal(raw)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid amount: {value}") from exc

    return amount, currency


def _log_skip(
    skip_log: Optional[List[Dict]],
    row_index: int,
    reason: str,
    row: Dict,
) -> None:
    if skip_log is None:
        return
    skip_log.append(
        {
            "row_index": row_index,
            "reason": reason,
            "transaction_date": row.get("תאריך העסקה", ""),
            "posting_date": row.get("תאריך חיוב", ""),
            "merchant": row.get("בית העסק", ""),
            "transaction_amount": row.get("סכום העסקה", ""),
            "charged_amount": row.get("סכום החיוב", ""),
        }
    )


def _normalize_header(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\ufeff", "").strip())


def _build_header_map(fieldnames: list[str]) -> dict:
    normalized = {_normalize_header(name): name for name in fieldnames}

    old_headers = {
        "תאריך חיוב": "posting_date",
        "תאריך העסקה": "transaction_date",
        "בית העסק": "merchant_raw",
        "סכום העסקה": "transaction_amount",
        "סכום החיוב": "charged_amount",
    }
    new_headers = {
        "תאריך עסקה": "transaction_date",
        "שם בית עסק": "merchant_raw",
        "סכום עסקה": "transaction_amount",
        "סכום חיוב": "charged_amount",
    }

    mapping = {}
    for label, key in {**old_headers, **new_headers}.items():
        if label in normalized:
            mapping[key] = normalized[label]

    return mapping


def parse_transactions_csv(
    upload: UploadFile,
    skip_log: Optional[List[Dict]] = None,
    default_posting_date: Optional[date] = None,
) -> list[dict]:
    raw_content = upload.file.read()
    if isinstance(raw_content, bytes):
        text = raw_content.decode("utf-8-sig")
    else:
        text = str(raw_content)
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("Missing headers")

    header_map = _build_header_map(reader.fieldnames)
    rows = list(reader)
    required_fields = {"transaction_date", "merchant_raw", "transaction_amount"}
    if not required_fields.issubset(header_map.keys()):
        raise ValueError("Missing required columns")

    tx_values = [row.get(header_map["transaction_date"], "").strip() for row in rows]
    posting_key = header_map.get("posting_date")
    posting_values = [row.get(posting_key, "").strip() for row in rows] if posting_key else []
    tx_formats = formats_for_order(detect_date_order(tx_values))
    posting_formats = formats_for_order(detect_date_order(posting_values)) if posting_key else tx_formats

    parsed_rows = []
    for row_index, row in enumerate(rows, start=2):
        try:
            raw_transaction_date = row.get(header_map["transaction_date"], "").strip()
            posting_key = header_map.get("posting_date")
            raw_posting_date = row.get(posting_key, "").strip() if posting_key else ""
            merchant_raw = row.get(header_map["merchant_raw"], "").strip()
            amount_raw = row.get(header_map["transaction_amount"], "").strip()

            if not any([raw_transaction_date, raw_posting_date, merchant_raw, amount_raw]):
                _log_skip(skip_log, row_index, "empty row", row)
                continue

            transaction_date = try_parse_date(raw_transaction_date, formats=tx_formats)
            posting_date = try_parse_date(raw_posting_date, formats=posting_formats)

            if not transaction_date and posting_date:
                transaction_date = posting_date
            if not posting_date and transaction_date:
                posting_date = default_posting_date or transaction_date

            if not transaction_date and not posting_date:
                if not merchant_raw and not amount_raw:
                    _log_skip(skip_log, row_index, "non-data row", row)
                    continue
                raise ValueError("Missing transaction date")

            if not merchant_raw:
                merchant_raw = "UNKNOWN"

            if not amount_raw:
                _log_skip(skip_log, row_index, "empty amount", row)
                continue

            transaction_amount, transaction_currency = parse_money(
                row.get(header_map["transaction_amount"], "")
            )
            charged_amount = None
            charged_currency = None
            charged_key = header_map.get("charged_amount")
            charged_value = row.get(charged_key, "").strip() if charged_key else ""
            if charged_value:
                charged_amount, charged_currency = parse_money(charged_value)

            parsed_rows.append(
                {
                    "transaction_date": transaction_date,
                    "posting_date": posting_date,
                    "merchant_raw": merchant_raw,
                    "transaction_amount": transaction_amount,
                    "transaction_currency": transaction_currency,
                    "charged_amount": charged_amount,
                    "charged_currency": charged_currency,
                    "normalized_merchant": normalize_merchant(merchant_raw),
                }
            )
        except ValueError as exc:
            raise ValueError(f"Row {row_index}: {exc}") from exc

    return parsed_rows
