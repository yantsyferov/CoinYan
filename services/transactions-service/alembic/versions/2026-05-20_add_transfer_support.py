"""add transfer support to transactions

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-20

"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the old CHECK constraint that only allows 'income' and 'expense'.
    # op.execute is used because Alembic does not portably manage named CHECK
    # constraints on PostgreSQL via drop_constraint for constraints that were
    # created inline with CREATE TABLE.
    op.execute("ALTER TABLE transactions DROP CONSTRAINT chk_transaction_type")

    # Re-create the constraint with the additional 'transfer' branch.
    # Transfers must have no category and no income source; the peer link is
    # tracked via the new transfer_peer_id column.
    op.execute(
        """
        ALTER TABLE transactions
        ADD CONSTRAINT chk_transaction_type CHECK (
            (type = 'expense'  AND expense_category_id IS NOT NULL AND income_source_id IS NULL)
            OR (type = 'income'   AND income_source_id IS NOT NULL AND expense_category_id IS NULL)
            OR (type = 'transfer' AND expense_category_id IS NULL  AND income_source_id IS NULL)
        )
        """
    )

    # Add the destination account for outgoing leg of a transfer.
    op.add_column(
        "transactions",
        sa.Column("transfer_to_account_id", sa.UUID(), nullable=True),
    )

    # Add the peer transaction ID so both legs of a transfer can be linked and
    # cancellation / lookup can find the counterpart in O(1).
    op.add_column(
        "transactions",
        sa.Column("transfer_peer_id", sa.UUID(), nullable=True),
    )

    # Index transfer_peer_id for fast peer lookups (e.g. during cancellation
    # both legs must be updated; a sequential scan would be unacceptable).
    # Partial index keeps it small: only rows that are actually transfers.
    op.create_index(
        "ix_transactions_transfer_peer",
        "transactions",
        ["transfer_peer_id"],
        postgresql_where=sa.text("transfer_peer_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_transactions_transfer_peer", table_name="transactions")
    op.drop_column("transactions", "transfer_peer_id")
    op.drop_column("transactions", "transfer_to_account_id")

    # Restore the original CHECK constraint that excludes 'transfer'.
    # Any rows with type='transfer' must be removed before running downgrade.
    op.execute("ALTER TABLE transactions DROP CONSTRAINT chk_transaction_type")
    op.execute(
        """
        ALTER TABLE transactions
        ADD CONSTRAINT chk_transaction_type CHECK (
            (type = 'expense' AND expense_category_id IS NOT NULL AND income_source_id IS NULL)
            OR (type = 'income' AND income_source_id IS NOT NULL AND expense_category_id IS NULL)
        )
        """
    )
