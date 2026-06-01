"""add_base_currency_to_users

Revision ID: e1f2a3b4c5d6
Revises: cd82689e256f
Create Date: 2026-05-28 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'cd82689e256f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'base_currency',
            sa.String(3),
            nullable=False,
            server_default='USD',
        ),
    )
    # Backfill any rows that may have slipped through without a value
    op.execute("UPDATE users SET base_currency = 'USD' WHERE base_currency IS NULL")


def downgrade() -> None:
    op.drop_column('users', 'base_currency')
