"""relax chk_transaction_type to allow income without income_source_id

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-26

"""
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing constraint that requires income_source_id IS NOT NULL
    # for income-type transactions.  income_source_id is now optional so that
    # income transactions can be recorded without linking them to a source.
    op.execute("ALTER TABLE transactions DROP CONSTRAINT chk_transaction_type")

    op.execute(
        """
        ALTER TABLE transactions
        ADD CONSTRAINT chk_transaction_type CHECK (
            (type = 'expense'  AND expense_category_id IS NOT NULL AND income_source_id IS NULL)
            OR (type = 'income'   AND expense_category_id IS NULL)
            OR (type = 'transfer' AND expense_category_id IS NULL  AND income_source_id IS NULL)
        )
        """
    )


def downgrade() -> None:
    # Restore the stricter constraint that requires income_source_id IS NOT NULL.
    # Any income rows with income_source_id = NULL must be removed or updated
    # before running downgrade.
    op.execute("ALTER TABLE transactions DROP CONSTRAINT chk_transaction_type")

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
