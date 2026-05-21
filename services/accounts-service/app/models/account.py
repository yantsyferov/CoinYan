import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import NUMERIC, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import text


class Base(DeclarativeBase):
    pass


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    starting_balance: Mapped[Decimal] = mapped_column(
        NUMERIC(18, 4),
        nullable=False,
        server_default=text("0"),
    )
    current_balance: Mapped[Decimal] = mapped_column(
        NUMERIC(18, 4),
        nullable=False,
        server_default=text("0"),
    )
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default="active",
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_accounts_user_id_status", "user_id", "status"),
        Index("ix_accounts_user_id_deleted_at", "user_id", "deleted_at"),
    )
