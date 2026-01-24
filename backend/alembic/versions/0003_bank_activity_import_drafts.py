"""add bank activity import drafts

Revision ID: 0003_bank_activity_import_drafts
Revises: 0002_bank_activities
Create Date: 2025-01-20
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0003_bank_activity_import_drafts"
down_revision = "0002_bank_activities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bank_activity_import_drafts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bank_account_id", sa.Integer(), sa.ForeignKey("bank_accounts.id")),
        sa.Column("source_filename", sa.String(length=255)),
        sa.Column("period_month", sa.Date(), nullable=False),
        sa.Column("row_count", sa.Integer()),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_table(
        "bank_activity_import_draft_rows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "draft_id",
            sa.Integer(),
            sa.ForeignKey("bank_activity_import_drafts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("row_index", sa.Integer(), nullable=False),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("value_date", sa.Date()),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("reference", sa.String(length=50)),
        sa.Column("payee_raw", sa.Text(), nullable=False),
        sa.Column("normalized_payee", sa.String(length=200), nullable=False),
        sa.Column("debit", sa.Numeric(12, 2)),
        sa.Column("credit", sa.Numeric(12, 2)),
        sa.Column("balance", sa.Numeric(12, 2)),
        sa.Column("currency", sa.String(length=3)),
        sa.Column("raw_category_text", sa.Text()),
        sa.Column("suggested_category_text", sa.Text()),
        sa.Column("approved_category_text", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_bank_activity_import_draft_rows_draft_id",
        "bank_activity_import_draft_rows",
        ["draft_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_bank_activity_import_draft_rows_draft_id",
        table_name="bank_activity_import_draft_rows",
    )
    op.drop_table("bank_activity_import_draft_rows")
    op.drop_table("bank_activity_import_drafts")
