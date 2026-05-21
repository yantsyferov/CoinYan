"""create_transactions_table

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-05-18 00:00:00.000000+00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'transactions',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(length=10), nullable=False),
        sa.Column('amount', sa.Numeric(precision=19, scale=4), nullable=False),
        sa.Column('account_id', sa.UUID(), nullable=False),
        sa.Column('expense_category_id', sa.UUID(), nullable=True),
        sa.Column('income_source_id', sa.UUID(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "(type = 'expense' AND expense_category_id IS NOT NULL AND income_source_id IS NULL)"
            " OR (type = 'income' AND income_source_id IS NOT NULL AND expense_category_id IS NULL)",
            name='chk_transaction_type',
        ),
    )
    op.create_index('ix_transactions_account', 'transactions', ['user_id', 'account_id'])
    op.create_index(
        'ix_transactions_expense_category',
        'transactions',
        ['user_id', 'expense_category_id'],
        postgresql_where=sa.text('expense_category_id IS NOT NULL'),
    )
    op.create_index(
        'ix_transactions_income_source',
        'transactions',
        ['user_id', 'income_source_id'],
        postgresql_where=sa.text('income_source_id IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('ix_transactions_income_source', table_name='transactions')
    op.drop_index('ix_transactions_expense_category', table_name='transactions')
    op.drop_index('ix_transactions_account', table_name='transactions')
    op.drop_table('transactions')
