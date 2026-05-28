import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction

if TYPE_CHECKING:
    from app.schemas.transaction import CreateTransferTransactionRequest


def _month_range(year: int, month: int) -> tuple[date, date]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
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
        source_currency: str,
        target_currency: str,
        rate_is_custom: bool,
        account_id: str,
        expense_category_id: Optional[str],
        income_source_id: Optional[str],
        note: Optional[str],
        transaction_date: date,
        session: AsyncSession,
    ) -> Transaction:
        row = Transaction(
            user_id=uuid.UUID(user_id),
            type=type,
            amount=amount,
            account_amount=account_amount,
            account_currency=account_currency,
            exchange_rate=exchange_rate,
            source_currency=source_currency,
            target_currency=target_currency,
            rate_is_custom=rate_is_custom,
            account_id=uuid.UUID(account_id),
            expense_category_id=uuid.UUID(expense_category_id) if expense_category_id else None,
            income_source_id=uuid.UUID(income_source_id) if income_source_id else None,
            note=note,
            transaction_date=transaction_date,
        )
        session.add(row)
        await session.flush()
        return row

    @staticmethod
    async def create_transfer_pair(
        user_id: str,
        data: "CreateTransferTransactionRequest",
        transaction_date: date,
        session: AsyncSession,
    ) -> tuple[Transaction, Transaction]:
        debit_leg = Transaction(
            user_id=uuid.UUID(user_id),
            type="transfer",
            amount=data.from_amount,
            account_amount=data.from_amount,
            account_currency=data.from_currency,
            exchange_rate=data.exchange_rate,
            source_currency=data.from_currency,
            target_currency=data.to_currency,
            rate_is_custom=False,
            account_id=data.from_account_id,
            from_account_id=data.from_account_id,
            transfer_to_account_id=data.to_account_id,
            note=data.note,
            transaction_date=transaction_date,
        )
        credit_leg = Transaction(
            user_id=uuid.UUID(user_id),
            type="transfer",
            amount=data.to_amount,
            account_amount=data.to_amount,
            account_currency=data.to_currency,
            exchange_rate=data.exchange_rate,
            source_currency=data.from_currency,
            target_currency=data.to_currency,
            rate_is_custom=False,
            account_id=data.to_account_id,
            from_account_id=data.from_account_id,
            transfer_to_account_id=data.to_account_id,
            note=data.note,
            transaction_date=transaction_date,
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
        limit: int = 50,
        offset: int = 0,
    ) -> list[Transaction]:
        if not any([account_id, expense_category_id, income_source_id]):
            raise ValueError("At least one filter is required")

        stmt = (
            select(Transaction)
            .where(Transaction.user_id == uuid.UUID(user_id))
        )

        if year is not None and month is not None:
            start, end = _month_range(year, month)
            stmt = stmt.where(Transaction.transaction_date >= start)
            stmt = stmt.where(Transaction.transaction_date < end)

        if account_id:
            stmt = stmt.where(Transaction.account_id == uuid.UUID(account_id))
        if expense_category_id:
            stmt = stmt.where(Transaction.expense_category_id == uuid.UUID(expense_category_id))
        if income_source_id:
            stmt = stmt.where(Transaction.income_source_id == uuid.UUID(income_source_id))

        stmt = stmt.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc()).limit(limit).offset(offset)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_totals(
        user_id: str,
        session: AsyncSession,
        year: Optional[int] = None,
        month: Optional[int] = None,
        after_date: Optional[datetime] = None,
    ) -> dict:
        if after_date is not None:
            after_date_only = after_date.date() if isinstance(after_date, datetime) else after_date
            expense_stmt = (
                select(Transaction.expense_category_id, func.sum(Transaction.amount).label("total"))
                .where(Transaction.user_id == uuid.UUID(user_id))
                .where(Transaction.type == "expense")
                .where(Transaction.expense_category_id.isnot(None))
                .where(Transaction.transaction_date >= after_date_only)
                .group_by(Transaction.expense_category_id)
            )
            expense_rows = await session.execute(expense_stmt)

            income_stmt = (
                select(Transaction.income_source_id, func.sum(Transaction.amount).label("total"))
                .where(Transaction.user_id == uuid.UUID(user_id))
                .where(Transaction.type == "income")
                .where(Transaction.income_source_id.isnot(None))
                .where(Transaction.transaction_date >= after_date_only)
                .group_by(Transaction.income_source_id)
            )
            income_rows = await session.execute(income_stmt)
        else:
            now = datetime.now(timezone.utc)
            start, end = _month_range(year or now.year, month or now.month)

            expense_stmt = (
                select(Transaction.expense_category_id, func.sum(Transaction.amount).label("total"))
                .where(Transaction.user_id == uuid.UUID(user_id))
                .where(Transaction.type == "expense")
                .where(Transaction.expense_category_id.isnot(None))
                .where(Transaction.transaction_date >= start)
                .where(Transaction.transaction_date < end)
                .group_by(Transaction.expense_category_id)
            )
            expense_rows = await session.execute(expense_stmt)

            income_stmt = (
                select(Transaction.income_source_id, func.sum(Transaction.amount).label("total"))
                .where(Transaction.user_id == uuid.UUID(user_id))
                .where(Transaction.type == "income")
                .where(Transaction.income_source_id.isnot(None))
                .where(Transaction.transaction_date >= start)
                .where(Transaction.transaction_date < end)
                .group_by(Transaction.income_source_id)
            )
            income_rows = await session.execute(income_stmt)

        return {
            "expense_categories": {str(r.expense_category_id): float(r.total) for r in expense_rows},
            "income_sources": {str(r.income_source_id): float(r.total) for r in income_rows},
        }

    @staticmethod
    async def get_totals_by_currency(
        session: AsyncSession,
        user_id: str,
        entity_type: str,
        entity_id: str,
        month: str,
    ) -> list[tuple[str, float]]:
        year_str, month_str = month.split("-")
        start, end = _month_range(int(year_str), int(month_str))

        stmt = (
            select(Transaction.source_currency, func.sum(Transaction.amount).label("total"))
            .where(Transaction.user_id == uuid.UUID(user_id))
            .where(Transaction.transaction_date >= start)
            .where(Transaction.transaction_date < end)
        )

        if entity_type == "category":
            stmt = stmt.where(Transaction.expense_category_id == uuid.UUID(entity_id))
            stmt = stmt.where(Transaction.type == "expense")
        elif entity_type == "income_source":
            stmt = stmt.where(Transaction.income_source_id == uuid.UUID(entity_id))
            stmt = stmt.where(Transaction.type == "income")
        else:
            raise ValueError(f"Unknown entity_type: {entity_type!r}")

        stmt = stmt.group_by(Transaction.source_currency)
        result = await session.execute(stmt)
        return [(row.source_currency, float(row.total)) for row in result]

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
    async def update_transaction(
        transaction_id: str,
        user_id: str,
        amount: Decimal,
        note: Optional[str],
        session: AsyncSession,
        transaction_date: Optional[date] = None,
        account_amount: Optional[Decimal] = None,
        exchange_rate: Optional[Decimal] = None,
        rate_is_custom: Optional[bool] = None,
    ) -> tuple["Transaction", Decimal]:
        txn = await TransactionRepository.get_by_id(transaction_id, user_id, session)
        if txn is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

        old_account_amount = txn.account_amount
        txn.amount = amount
        if account_amount is not None:
            txn.account_amount = account_amount
        if exchange_rate is not None:
            txn.exchange_rate = exchange_rate
        if rate_is_custom is not None:
            txn.rate_is_custom = rate_is_custom
        txn.note = note if note else None
        if transaction_date is not None:
            txn.transaction_date = transaction_date
        await session.flush()
        await session.refresh(txn)
        return txn, old_account_amount

    @staticmethod
    async def update_transfer_pair(
        transaction_id: uuid.UUID,
        user_id: uuid.UUID,
        amount: Decimal,
        note: Optional[str],
        session: AsyncSession,
        transaction_date: Optional[date] = None,
    ) -> tuple["Transaction", "Transaction", Decimal, Decimal]:
        stmt = (
            select(Transaction)
            .where(Transaction.id == transaction_id)
            .where(Transaction.user_id == user_id)
        )
        result = await session.execute(stmt)
        target = result.scalar_one_or_none()
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
        if target.transfer_peer_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Transaction is a transfer but has no peer leg",
            )

        peer_stmt = select(Transaction).where(Transaction.id == target.transfer_peer_id)
        peer_result = await session.execute(peer_stmt)
        peer = peer_result.scalar_one_or_none()
        if peer is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Transfer peer leg not found",
            )

        old_amount = target.account_amount
        old_peer_amount = peer.account_amount

        target.amount = amount
        target.account_amount = amount
        target.note = note if note else None

        peer.amount = amount
        peer.account_amount = amount
        peer.note = note if note else None

        if transaction_date is not None:
            target.transaction_date = transaction_date
            peer.transaction_date = transaction_date

        await session.flush()
        await session.refresh(target)
        await session.refresh(peer)

        return target, peer, old_amount, old_peer_amount

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

    @staticmethod
    async def get_cumulative_balance(
        session: AsyncSession,
        user_id: UUID,
        date_to: datetime,
    ) -> Decimal | None:
        stmt = select(
            func.count().label("row_count"),
            func.sum(
                case(
                    (Transaction.type == "income", Transaction.account_amount),
                    else_=Decimal("0"),
                )
            ).label("total_income"),
            func.sum(
                case(
                    (Transaction.type == "expense", Transaction.account_amount),
                    else_=Decimal("0"),
                )
            ).label("total_expense"),
        ).where(
            Transaction.user_id == user_id,
            Transaction.type.in_(["income", "expense"]),
            Transaction.transaction_date <= (date_to.date() if isinstance(date_to, datetime) else date_to),
        )
        result = await session.execute(stmt)
        row = result.one()
        if row.row_count == 0:
            return None
        return Decimal(row.total_income) - Decimal(row.total_expense)
