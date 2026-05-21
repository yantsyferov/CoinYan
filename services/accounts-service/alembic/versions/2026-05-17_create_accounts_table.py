"""create_accounts_table

Revision ID: a3f7c2d81b4e
Revises:
Create Date: 2026-05-17 00:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f7c2d81b4e'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'accounts',
        sa.Column(
            'id',
            sa.UUID(),
            server_default=sa.text('gen_random_uuid()'),
            nullable=False,
        ),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('icon', sa.String(length=50), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column(
            'starting_balance',
            sa.Numeric(18, 4),
            server_default=sa.text('0'),
            nullable=False,
        ),
        sa.Column(
            'current_balance',
            sa.Numeric(18, 4),
            server_default=sa.text('0'),
            nullable=False,
        ),
        sa.Column(
            'status',
            sa.String(length=30),
            server_default=sa.text("'active'"),
            nullable=False,
        ),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
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
    )
    op.create_index(
        'ix_accounts_user_id_status',
        'accounts',
        ['user_id', 'status'],
        unique=False,
    )
    op.create_index(
        'ix_accounts_user_id_deleted_at',
        'accounts',
        ['user_id', 'deleted_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_accounts_user_id_deleted_at', table_name='accounts')
    op.drop_index('ix_accounts_user_id_status', table_name='accounts')
    op.drop_table('accounts')
