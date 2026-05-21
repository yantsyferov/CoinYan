"""add currency fields to transactions

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-18

"""
from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("account_currency", sa.String(3), nullable=False, server_default="USD"))
    op.add_column("transactions", sa.Column("account_amount", sa.Numeric(19, 4), nullable=True))
    op.add_column("transactions", sa.Column("exchange_rate", sa.Numeric(18, 6), nullable=False, server_default="1.0"))
    op.execute("UPDATE transactions SET account_amount = amount")
    op.alter_column("transactions", "account_amount", nullable=False)


def downgrade() -> None:
    op.drop_column("transactions", "exchange_rate")
    op.drop_column("transactions", "account_amount")
    op.drop_column("transactions", "account_currency")
