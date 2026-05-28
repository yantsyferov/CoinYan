"""add source_currency, target_currency, rate_is_custom to transactions

Revision ID: a0b1c2d3e4f5
Revises: f6a7b8c9d0e1
Create Date: 2026-05-28

"""
from alembic import op
import sqlalchemy as sa

revision = "a0b1c2d3e4f5"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add source_currency: temporarily nullable so we can backfill before
    # enforcing NOT NULL.  server_default handles any rows created in the
    # narrow window between the ADD COLUMN and the explicit UPDATE below.
    op.add_column(
        "transactions",
        sa.Column(
            "source_currency",
            sa.String(3),
            nullable=True,
            server_default="USD",
        ),
    )
    op.add_column(
        "transactions",
        sa.Column(
            "target_currency",
            sa.String(3),
            nullable=True,
            server_default="USD",
        ),
    )
    op.add_column(
        "transactions",
        sa.Column(
            "rate_is_custom",
            sa.Boolean(),
            nullable=True,
            server_default=sa.false(),
        ),
    )

    # Backfill source_currency from account_currency for all existing rows.
    op.execute(
        "UPDATE transactions SET source_currency = account_currency"
    )

    # Backfill target_currency:
    #   - expense rows  → 'USD'   (the account is the source; USD is the report currency)
    #   - income rows   → account_currency  (income arrives in the account's own currency)
    #   - transfer rows → account_currency  (inter-account moves stay in that account's currency)
    op.execute(
        """
        UPDATE transactions
        SET target_currency = CASE
            WHEN type = 'expense' THEN 'USD'
            ELSE account_currency
        END
        """
    )

    # Backfill rate_is_custom: all existing rows were created without a custom
    # rate, so default to FALSE.
    op.execute(
        "UPDATE transactions SET rate_is_custom = FALSE WHERE rate_is_custom IS NULL"
    )

    # Now that every row is populated, enforce NOT NULL and drop the
    # server_defaults so the application must always supply these values
    # explicitly going forward.
    op.alter_column("transactions", "source_currency", nullable=False, server_default=None)
    op.alter_column("transactions", "target_currency", nullable=False, server_default=None)
    op.alter_column("transactions", "rate_is_custom", nullable=False, server_default=None)


def downgrade() -> None:
    op.drop_column("transactions", "rate_is_custom")
    op.drop_column("transactions", "target_currency")
    op.drop_column("transactions", "source_currency")
