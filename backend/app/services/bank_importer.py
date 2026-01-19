import csv
import io
import re
from decimal import Decimal
from typing import Dict, List, Optional

from fastapi import UploadFile

from .importer import detect_date_order, formats_for_order, parse_money, try_parse_date


def normalize_payee(name: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", name, flags=re.UNICODE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.casefold()


def _normalize_header(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\ufeff", "").strip())


def _build_header_map(fieldnames: list[str]) -> dict:
    normalized = {_normalize_header(name): name for name in fieldnames}

    headers = {
        "תאריך": "activity_date",
        "תאריך ערך": "value_date",
        "תיאור": "description",
        "סוג תנועה": "description",
        "אסמכתא": "reference",
        "חובה": "debit",
        "זכות": "credit",
        "יתרה בש\"ח": "balance",
        "סוגי קטגוריות": "raw_category_text",
    }

    mapping = {}
    for label, key in headers.items():
        if label in normalized:
            mapping[key] = normalized[label]

    return mapping


def _parse_amount(value: str) -> Optional[Decimal]:
    if not value or not value.strip():
        return None
    amount, _ = parse_money(value)
    return amount


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
            "activity_date": row.get("תאריך", row.get("תאריך ", "")),
            "description": row.get("תיאור", row.get("סוג תנועה", "")),
            "reference": row.get("אסמכתא", ""),
            "debit": row.get("חובה", ""),
            "credit": row.get("זכות", ""),
            "balance": row.get("יתרה בש\"ח", ""),
            "raw_category_text": row.get("סוגי קטגוריות", ""),
        }
    )


def parse_bank_activities_csv(
    upload: UploadFile,
    skip_log: Optional[List[Dict]] = None,
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
    if "activity_date" not in header_map or "description" not in header_map:
        raise ValueError("Missing required columns")

    rows = list(reader)

    activity_values = [row.get(header_map["activity_date"], "").strip() for row in rows]
    value_key = header_map.get("value_date")
    value_values = [row.get(value_key, "").strip() for row in rows] if value_key else []
    activity_formats = formats_for_order(detect_date_order(activity_values))
    value_formats = (
        formats_for_order(detect_date_order(value_values)) if value_key else activity_formats
    )

    parsed_rows = []
    for row_index, row in enumerate(rows, start=2):
        raw_activity_date = row.get(header_map["activity_date"], "").strip()
        raw_value_date = row.get(value_key, "").strip() if value_key else ""
        description = row.get(header_map["description"], "").strip()
        reference = row.get(header_map.get("reference", ""), "").strip()
        debit_raw = row.get(header_map.get("debit", ""), "").strip()
        credit_raw = row.get(header_map.get("credit", ""), "").strip()
        balance_raw = row.get(header_map.get("balance", ""), "").strip()
        raw_category = row.get(header_map.get("raw_category_text", ""), "").strip()

        if not any([raw_activity_date, raw_value_date, description, debit_raw, credit_raw]):
            _log_skip(skip_log, row_index, "empty row", row)
            continue

        activity_date = try_parse_date(raw_activity_date, formats=activity_formats)
        value_date = try_parse_date(raw_value_date, formats=value_formats)

        if not activity_date and value_date:
            activity_date = value_date

        if not activity_date:
            _log_skip(skip_log, row_index, "missing activity date", row)
            continue

        debit = _parse_amount(debit_raw)
        credit = _parse_amount(credit_raw)
        balance = _parse_amount(balance_raw)

        if debit is None and credit is None:
            _log_skip(skip_log, row_index, "empty amount", row)
            continue

        if not description:
            description = "UNKNOWN"

        payee_raw = description
        parsed_rows.append(
            {
                "activity_date": activity_date,
                "value_date": value_date,
                "description": description,
                "reference": reference or None,
                "debit": debit,
                "credit": credit,
                "balance": balance,
                "currency": "ILS",
                "raw_category_text": raw_category or None,
                "payee_raw": payee_raw,
                "normalized_payee": normalize_payee(payee_raw),
            }
        )

    return parsed_rows
