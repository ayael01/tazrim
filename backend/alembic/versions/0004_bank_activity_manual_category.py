from alembic import op
import sqlalchemy as sa

revision = "0004_bank_activity_manual_category"
down_revision = "0003_bank_activity_import_drafts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(32),
        type_=sa.String(64),
        nullable=False,
    )
    op.add_column(
        "bank_activities",
        sa.Column("manual_category_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_bank_activities_manual_category",
        "bank_activities",
        "bank_activity_categories",
        ["manual_category_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_bank_activities_manual_category",
        "bank_activities",
        type_="foreignkey",
    )
    op.drop_column("bank_activities", "manual_category_id")
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(64),
        type_=sa.String(32),
        nullable=False,
    )
