from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account


class AccountRepository:
    @staticmethod
    async def get_active_by_user_id(
        session: AsyncSession,
        user_id: str,
    ) -> list[Account]:
        """Return all active accounts owned by *user_id*, ordered by creation date."""
        result = await session.execute(
            select(Account)
            .where(
                Account.user_id == UUID(user_id),
                Account.status == "active",
            )
            .order_by(Account.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create(
        session: AsyncSession,
        user_id: str,
        name: str,
        icon: str,
        currency: str,
        starting_balance: Decimal,
    ) -> Account:
        """Insert a new account and flush so DB-generated fields are populated."""
        account = Account(
            user_id=UUID(user_id),
            name=name,
            icon=icon,
            currency=currency,
            starting_balance=starting_balance,
            current_balance=starting_balance,
        )
        session.add(account)
        await session.flush()
        return account

    @staticmethod
    async def get_by_id(
        session: AsyncSession,
        account_id: str,
        user_id: str,
    ) -> Account | None:
        """Fetch a single account by primary key with an ownership check.

        Returns ``None`` when the account does not exist or belongs to a
        different user.
        """
        result = await session.execute(
            select(Account).where(
                Account.id == UUID(account_id),
                Account.user_id == UUID(user_id),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_name_and_icon(
        session: AsyncSession,
        account: Account,
        name: str,
        icon: str,
    ) -> Account:
        """Mutate *account* in-place, flush to DB, and return it."""
        account.name = name
        account.icon = icon
        await session.flush()
        return account

    @staticmethod
    async def get_recoverable_by_user_id(session: AsyncSession, user_id: str) -> list[Account]:
        """Accounts soft-deleted or archived within the 30-day recovery window."""
        from datetime import datetime, timezone, timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        result = await session.execute(
            select(Account).where(
                Account.user_id == UUID(user_id),
                Account.status != "active",
                Account.deleted_at > cutoff,
            ).order_by(Account.deleted_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def set_status(session: AsyncSession, account: Account, status: str, deleted_at=None) -> Account:
        from datetime import datetime, timezone
        account.status = status
        account.deleted_at = deleted_at if deleted_at is not None else datetime.now(timezone.utc)
        await session.flush()
        return account

    @staticmethod
    async def restore_account(session: AsyncSession, account: Account) -> Account:
        account.status = "active"
        account.deleted_at = None
        await session.flush()
        return account
