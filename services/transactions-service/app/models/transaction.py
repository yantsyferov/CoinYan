import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)
    account_amount: Mapped[Decimal] = mapped_column(Numeric(19, 4), nullable=False)
    account_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, default=Decimal("1.0"))
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    expense_category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    income_source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    transfer_to_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    transfer_peer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    from_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "(type = 'expense'  AND expense_category_id IS NOT NULL AND income_source_id IS NULL)"
            " OR (type = 'income'   AND income_source_id IS NOT NULL AND expense_category_id IS NULL)"
            " OR (type = 'transfer' AND expense_category_id IS NULL  AND income_source_id IS NULL)",
            name="chk_transaction_type",
        ),
        Index("ix_transactions_account", "user_id", "account_id"),
        Index(
            "ix_transactions_expense_category",
            "user_id",
            "expense_category_id",
            postgresql_where=expense_category_id.isnot(None),
        ),
        Index(
            "ix_transactions_income_source",
            "user_id",
            "income_source_id",
            postgresql_where=income_source_id.isnot(None),
        ),
        Index(
            "ix_transactions_transfer_peer",
            "transfer_peer_id",
            postgresql_where=transfer_peer_id.isnot(None),
        ),
    )
