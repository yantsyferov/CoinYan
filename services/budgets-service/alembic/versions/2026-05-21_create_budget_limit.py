"""create_budget_limit

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-05-21 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'budget_limit',
        sa.Column(
            'id',
            sa.UUID(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('expense_category_id', sa.UUID(), nullable=False),
        sa.Column(
            'amount',
            sa.Numeric(precision=19, scale=4),
            nullable=False,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.CheckConstraint('amount > 0', name='ck_budget_limit_amount_positive'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'user_id', 'expense_category_id',
            name='uq_budget_limit_user_category',
        ),
    )
    op.create_index(
        'ix_budget_limit_user_id',
        'budget_limit',
        ['user_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_budget_limit_user_id', table_name='budget_limit')
    op.drop_table('budget_limit')
