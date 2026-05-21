import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction

if TYPE_CHECKING:
    from app.schemas.transaction import CreateTransferTransactionRequest


def _month_range(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    return start, end


class TransactionRepository:
    @staticmethod
    async def create(
        user_id: str,
        type: str,
        amount: Decimal,
        account_amount: Decimal,
        account_currency: str,
        exchange_rate: Decimal,
        account_id: str,
        expense_category_id: Optional[str],
        income_source_id: Optional[str],
        note: Optional[str],
        session: AsyncSession,
    ) -> Transaction:
        row = Transaction(
            user_id=uuid.UUID(user_id),
            type=type,
            amount=amount,
            account_amount=account_amount,
            account_currency=account_currency,
            exchange_rate=exchange_rate,
            account_id=uuid.UUID(account_id),
            expense_category_id=uuid.UUID(expense_category_id) if expense_category_id else None,
            income_source_id=uuid.UUID(income_source_id) if income_source_id else None,
            note=note,
        )
        session.add(row)
        await session.flush()
        return row

    @staticmethod
    async def create_transfer_pair(
        user_id: str,
        data: "CreateTransferTransactionRequest",
        session: AsyncSession,
    ) -> tuple[Transaction, Transaction]:
        debit_leg = Transaction(
            user_id=uuid.UUID(user_id),
            type="transfer",
            amount=data.from_amount,
            account_amount=data.from_amount,
            account_currency=data.from_currency,
            exchange_rate=data.exchange_rate,
            account_id=data.from_account_id,
            from_account_id=data.from_account_id,
            transfer_to_account_id=data.to_account_id,
            note=data.note,
        )
        credit_leg = Transaction(
            user_id=uuid.UUID(user_id),
            type="transfer",
            amount=data.to_amount,
            account_amount=data.to_amount,
            account_currency=data.to_currency,
            exchange_rate=data.exchange_rate,
            account_id=data.to_account_id,
            from_account_id=data.from_account_id,
            transfer_to_account_id=data.to_account_id,
            note=data.note,
        )
        session.add(debit_leg)
        session.add(credit_leg)
        # First flush assigns UUIDs without committing
        await session.flush()
        # Cross-link the two legs
        debit_leg.transfer_peer_id = credit_leg.id
        credit_leg.transfer_peer_id = debit_leg.id
        # Second flush persists the cross-references
        await session.flush()
        await session.refresh(debit_leg)
        await session.refresh(credit_leg)
        return debit_leg, credit_leg

    @staticmethod
    async def list_by_filter(
        user_id: str,
        session: AsyncSession,
        account_id: Optional[str] = None,
        expense_category_id: Optional[str] = None,
        income_source_id: Optional[str] = None,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> list[Transaction]:
        if not any([account_id, expense_category_id, income_source_id]):
            raise ValueError("At least one filter is required")

        now = datetime.now(timezone.utc)
        start, end = _month_range(year or now.year, month or now.month)

        stmt = (
            select(Transaction)
            .where(Transaction.user_id == uuid.UUID(user_id))
            .where(Transaction.created_at >= start)
            .where(Transaction.created_at < end)
        )

        if account_id:
            stmt = stmt.where(Transaction.account_id == uuid.UUID(account_id))
        if expense_category_id:
            stmt = stmt.where(Transaction.expense_category_id == uuid.UUID(expense_category_id))
        if income_source_id:
            stmt = stmt.where(Transaction.income_source_id == uuid.UUID(income_source_id))

        stmt = stmt.order_by(Transaction.created_at.desc()).limit(100)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_totals(
        user_id: str,
        session: AsyncSession,
        year: Optional[int] = None,
        month: Optional[int] = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        start, end = _month_range(year or now.year, month or now.month)

        expense_stmt = (
            select(Transaction.expense_category_id, func.sum(Transaction.amount).label("total"))
            .where(Transaction.user_id == uuid.UUID(user_id))
            .where(Transaction.type == "expense")
            .where(Transaction.expense_category_id.isnot(None))
            .where(Transaction.created_at >= start)
            .where(Transaction.created_at < end)
            .group_by(Transaction.expense_category_id)
        )
        expense_rows = await session.execute(expense_stmt)

        income_stmt = (
            select(Transaction.income_source_id, func.sum(Transaction.amount).label("total"))
            .where(Transaction.user_id == uuid.UUID(user_id))
            .where(Transaction.type == "income")
            .where(Transaction.income_source_id.isnot(None))
            .where(Transaction.created_at >= start)
            .where(Transaction.created_at < end)
            .group_by(Transaction.income_source_id)
        )
        income_rows = await session.execute(income_stmt)

        return {
            "expense_categories": {str(r.expense_category_id): float(r.total) for r in expense_rows},
            "income_sources": {str(r.income_source_id): float(r.total) for r in income_rows},
        }

    @staticmethod
    async def get_by_id(
        transaction_id: str,
        user_id: str,
        session: AsyncSession,
    ) -> Optional[Transaction]:
        stmt = (
            select(Transaction)
            .where(Transaction.id == uuid.UUID(transaction_id))
            .where(Transaction.user_id == uuid.UUID(user_id))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def delete_transfer_pair(
        transaction_id: str,
        user_id: str,
        session: AsyncSession,
    ) -> dict:
        txn = await TransactionRepository.get_by_id(transaction_id, user_id, session)
        if txn is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
        if txn.type != "transfer" or txn.transfer_peer_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transaction is not a transfer",
            )

        peer_stmt = select(Transaction).where(Transaction.id == txn.transfer_peer_id)
        peer_result = await session.execute(peer_stmt)
        peer = peer_result.scalar_one_or_none()

        # Identify which leg is the debit (source) using from_account_id.
        # On the debit leg, account_id == from_account_id.
        if peer is not None and txn.from_account_id is not None and txn.account_id != txn.from_account_id:
            debit, credit = peer, txn
        else:
            debit, credit = txn, peer

        from_amount = float(debit.amount)
        to_amount = float(credit.amount) if credit else 0.0
        from_account_id = str(debit.account_id)
        to_account_id = str(credit.account_id) if credit else ""

        await session.delete(txn)
        if peer is not None:
            await session.delete(peer)
        await session.commit()

        return {
            "from_amount": from_amount,
            "to_amount": to_amount,
            "from_account_id": from_account_id,
            "to_account_id": to_account_id,
        }
