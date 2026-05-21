"""add from_account_id to transactions for transfer direction

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("from_account_id", UUID(as_uuid=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("transactions", "from_account_id")
