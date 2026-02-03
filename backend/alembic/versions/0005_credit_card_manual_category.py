"""add manual category override to transactions

Revision ID: 0005_credit_card_manual_category
Revises: 0004_bank_activity_manual_category
Create Date: 2026-01-26
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_credit_card_manual_category"
down_revision = "0004_bank_activity_manual_category"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("manual_category_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_transactions_manual_category",
        "transactions",
        "categories",
        ["manual_category_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_transactions_manual_category",
        "transactions",
        type_="foreignkey",
    )
    op.drop_column("transactions", "manual_category_id")
