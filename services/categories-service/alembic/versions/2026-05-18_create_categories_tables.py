"""create_categories_tables

Revision ID: b1c2d3e4f5a6
Revises:
Create Date: 2026-05-18 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'expense_categories',
        sa.Column(
            'id',
            sa.UUID(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('icon', sa.String(length=50), nullable=False),
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
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_expense_categories_user_name'),
    )
    op.create_index(
        'ix_expense_categories_user_id',
        'expense_categories',
        ['user_id'],
        unique=False,
    )
    op.create_table(
        'income_sources',
        sa.Column(
            'id',
            sa.UUID(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('icon', sa.String(length=50), nullable=False),
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
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_income_sources_user_name'),
    )
    op.create_index(
        'ix_income_sources_user_id',
        'income_sources',
        ['user_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_income_sources_user_id', table_name='income_sources')
    op.drop_table('income_sources')
    op.drop_index('ix_expense_categories_user_id', table_name='expense_categories')
    op.drop_table('expense_categories')
