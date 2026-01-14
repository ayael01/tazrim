"""init schema

Revision ID: 0001_init
Revises: 
Create Date: 2025-01-01 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_init"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "card_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("issuer", sa.String(length=100), nullable=True),
        sa.Column("last4", sa.String(length=4), nullable=True),
    )

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
    )

    op.create_table(
        "merchants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("normalized_name", sa.String(length=200), nullable=False, unique=True),
        sa.Column("display_name", sa.String(length=200), nullable=False),
    )

    op.create_table(
        "merchant_category_map",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("merchant_id", sa.Integer(), sa.ForeignKey("merchants.id"), unique=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "import_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("card_account_id", sa.Integer(), sa.ForeignKey("card_accounts.id")),
        sa.Column("source_filename", sa.String(length=255), nullable=True),
        sa.Column("period_month", sa.Date(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("card_account_id", sa.Integer(), sa.ForeignKey("card_accounts.id")),
        sa.Column("import_batch_id", sa.Integer(), sa.ForeignKey("import_batches.id")),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("posting_date", sa.Date(), nullable=True),
        sa.Column("merchant_raw", sa.Text(), nullable=False),
        sa.Column("merchant_id", sa.Integer(), sa.ForeignKey("merchants.id"), nullable=True),
        sa.Column("transaction_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("transaction_currency", sa.String(length=3), nullable=False),
        sa.Column("charged_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("charged_currency", sa.String(length=3), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_index(
        "ix_transactions_transaction_date",
        "transactions",
        ["transaction_date"],
    )
    op.create_index(
        "ix_transactions_merchant_id",
        "transactions",
        ["merchant_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_transactions_merchant_id", table_name="transactions")
    op.drop_index("ix_transactions_transaction_date", table_name="transactions")
    op.drop_table("transactions")
    op.drop_table("import_batches")
    op.drop_table("merchant_category_map")
    op.drop_table("merchants")
    op.drop_table("categories")
    op.drop_table("card_accounts")
