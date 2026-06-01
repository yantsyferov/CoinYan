"""add base_currency_code, base_currency_rate, base_currency_amount to transactions

Revision ID: c1d2e3f4a5b6
Revises: a0b1c2d3e4f5
Create Date: 2026-05-29

"""
from alembic import op
import sqlalchemy as sa

revision = "c1d2e3f4a5b6"
down_revision = "a0b1c2d3e4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("base_currency_code", sa.String(3), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("base_currency_rate", sa.Numeric(18, 6), nullable=True),
    )
    op.add_column(
        "transactions",
        sa.Column("base_currency_amount", sa.Numeric(19, 4), nullable=True),
    )

    # Backfill rows where either the account currency or the source currency is
    # USD.  For these rows the account_amount is already expressed in USD, so:
    #   base_currency_code   = 'USD'
    #   base_currency_rate   = exchange_rate  (source → account rate stored on the row)
    #   base_currency_amount = account_amount (already in account_currency = USD)
    #
    # Rows where neither currency is USD are left NULL and handled gracefully at
    # read time (the application must supply base-currency data for those rows
    # via a subsequent update).
    op.execute(
        """
        UPDATE transactions
        SET
            base_currency_code   = 'USD',
            base_currency_rate   = exchange_rate,
            base_currency_amount = account_amount
        WHERE account_currency = 'USD'
           OR source_currency  = 'USD'
        """
    )


def downgrade() -> None:
    op.drop_column("transactions", "base_currency_amount")
    op.drop_column("transactions", "base_currency_rate")
    op.drop_column("transactions", "base_currency_code")
