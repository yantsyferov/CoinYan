"""add transaction_date column to transactions

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-26

"""
from alembic import op
import sqlalchemy as sa

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add the column with a server_default so Postgres backfills every existing
    # row atomically before the DDL statement completes.  NOT NULL is safe here
    # because server_default guarantees no NULL values remain after the ALTER.
    op.add_column(
        "transactions",
        sa.Column(
            "transaction_date",
            sa.Date(),
            nullable=False,
            server_default=sa.text("CURRENT_DATE"),
        ),
    )

    # Remove the server_default now that all rows are populated.
    # Going forward the application is responsible for supplying this value
    # explicitly, so we do not want Postgres to silently accept omissions.
    op.alter_column("transactions", "transaction_date", server_default=None)


def downgrade() -> None:
    op.drop_column("transactions", "transaction_date")
