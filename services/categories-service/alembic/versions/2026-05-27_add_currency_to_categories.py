"""add_currency_to_categories

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-05-27 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'expense_categories',
        sa.Column(
            'currency',
            sa.String(length=3),
            nullable=False,
            server_default='USD',
        ),
    )
    op.add_column(
        'income_sources',
        sa.Column(
            'currency',
            sa.String(length=3),
            nullable=False,
            server_default='USD',
        ),
    )


def downgrade() -> None:
    op.drop_column('income_sources', 'currency')
    op.drop_column('expense_categories', 'currency')
