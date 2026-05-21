from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.account import Account
from app.repositories.account_repo import AccountRepository


class AccountService:
    @staticmethod
    async def get_or_seed_accounts(
        session: AsyncSession,
        user_id: str,
    ) -> list[Account]:
        """Return the user's active accounts, seeding a default Cash account on first access.

        On first call for a given user the account list will be empty. We
        optimistically insert a Cash account so subsequent calls return at
        least one record. Concurrent first-requests may produce two Cash
        accounts in rare race conditions — this is acceptable for V1 and can
        be addressed by a unique partial index in a future migration.
        """
        accounts = await AccountRepository.get_active_by_user_id(session, user_id)

        if not accounts:
            await AccountRepository.create(
                session,
                user_id,
                name="Cash",
                icon="cash",
                currency=settings.DEFAULT_ACCOUNT_CURRENCY,
                starting_balance=Decimal("0"),
            )
            accounts = await AccountRepository.get_active_by_user_id(session, user_id)

        return accounts

    @staticmethod
    async def create_account(
        session: AsyncSession,
        user_id: str,
        name: str,
        icon: str,
        currency: str,
        starting_balance: Decimal,
    ) -> Account:
        account = await AccountRepository.create(
            session, user_id, name, icon, currency, starting_balance
        )
        return account

    @staticmethod
    async def get_account(
        session: AsyncSession,
        account_id: str,
        user_id: str,
    ) -> Account:
        from fastapi import HTTPException, status
        account = await AccountRepository.get_by_id(session, account_id, user_id)
        if account is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        return account

    @staticmethod
    async def update_account(
        session: AsyncSession,
        account_id: str,
        user_id: str,
        name: str,
        icon: str,
    ) -> Account:
        from fastapi import HTTPException, status
        account = await AccountRepository.get_by_id(session, account_id, user_id)
        if account is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        return await AccountRepository.update_name_and_icon(session, account, name, icon)

    @staticmethod
    async def archive_account(session: AsyncSession, account_id: str, user_id: str) -> None:
        account = await AccountRepository.get_by_id(session, account_id, user_id)
        if account is None:
            from fastapi import HTTPException, status as http_status
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Account not found")
        await AccountRepository.set_status(session, account, "archived")

    @staticmethod
    async def delete_account(session: AsyncSession, account_id: str, user_id: str, option: str) -> None:
        account = await AccountRepository.get_by_id(session, account_id, user_id)
        if account is None:
            from fastapi import HTTPException, status as http_status
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Account not found")
        status_map = {"keep_history": "deleted_keep_history", "delete_all": "deleted_all"}
        await AccountRepository.set_status(session, account, status_map[option])

    @staticmethod
    async def restore_account_by_id(session: AsyncSession, account_id: str, user_id: str) -> Account:
        from datetime import datetime, timezone, timedelta
        account = await AccountRepository.get_by_id(session, account_id, user_id)
        if account is None:
            from fastapi import HTTPException, status as http_status
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Account not found")
        if account.deleted_at is None or datetime.now(timezone.utc) - account.deleted_at > timedelta(days=30):
            from fastapi import HTTPException, status as http_status
            raise HTTPException(status_code=http_status.HTTP_409_CONFLICT, detail="Recovery window has expired")
        return await AccountRepository.restore_account(session, account)

    @staticmethod
    async def get_recoverable_accounts(session: AsyncSession, user_id: str) -> list[Account]:
        return await AccountRepository.get_recoverable_by_user_id(session, user_id)

    @staticmethod
    async def adjust_balance(session: AsyncSession, account_id: str, user_id: str, delta) -> Account:
        from decimal import Decimal
        from sqlalchemy import update as sa_update
        account = await AccountRepository.get_by_id(session, account_id, user_id)
        if account is None:
            from fastapi import HTTPException, status as http_status
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Account not found")
        # Atomic SQL delta update
        await session.execute(
            sa_update(Account)
            .where(Account.id == account.id)
            .values(current_balance=Account.current_balance + Decimal(str(delta)))
        )
        await session.flush()
        await session.refresh(account)
        return account
