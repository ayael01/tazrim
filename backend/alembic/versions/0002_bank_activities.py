"""add bank activity tables

Revision ID: 0002_bank_activities
Revises: 0001_init
Create Date: 2025-01-19 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_bank_activities"
down_revision: Union[str, None] = "0001_init"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bank_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("bank_name", sa.String(length=100), nullable=True),
        sa.Column("last4", sa.String(length=4), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
    )

    op.create_table(
        "bank_activity_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
    )

    op.create_table(
        "bank_payees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("normalized_name", sa.String(length=200), nullable=False, unique=True),
        sa.Column("display_name", sa.String(length=200), nullable=False),
    )

    op.create_table(
        "bank_payee_category_map",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("payee_id", sa.Integer(), sa.ForeignKey("bank_payees.id"), unique=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("bank_activity_categories.id")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "bank_activity_import_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bank_account_id", sa.Integer(), sa.ForeignKey("bank_accounts.id")),
        sa.Column("source_filename", sa.String(length=255), nullable=True),
        sa.Column("period_month", sa.Date(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "bank_activities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bank_account_id", sa.Integer(), sa.ForeignKey("bank_accounts.id")),
        sa.Column(
            "import_batch_id",
            sa.Integer(),
            sa.ForeignKey("bank_activity_import_batches.id"),
        ),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("value_date", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("reference", sa.String(length=50), nullable=True),
        sa.Column("payee_raw", sa.Text(), nullable=False),
        sa.Column("payee_id", sa.Integer(), sa.ForeignKey("bank_payees.id"), nullable=True),
        sa.Column("debit", sa.Numeric(12, 2), nullable=True),
        sa.Column("credit", sa.Numeric(12, 2), nullable=True),
        sa.Column("balance", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("raw_category_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_index(
        "ix_bank_activities_activity_date",
        "bank_activities",
        ["activity_date"],
    )
    op.create_index(
        "ix_bank_activities_payee_id",
        "bank_activities",
        ["payee_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_bank_activities_payee_id", table_name="bank_activities")
    op.drop_index("ix_bank_activities_activity_date", table_name="bank_activities")
    op.drop_table("bank_activities")
    op.drop_table("bank_activity_import_batches")
    op.drop_table("bank_payee_category_map")
    op.drop_table("bank_payees")
    op.drop_table("bank_activity_categories")
    op.drop_table("bank_accounts")
