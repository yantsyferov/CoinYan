from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


class UserRepository:
    @staticmethod
    async def create_user(
        session: AsyncSession,
        display_name: str,
        email: str,
        password_hash: str,
        base_currency: str = 'USD',
    ) -> User:
        user = User(
            display_name=display_name,
            email=email.lower(),
            password_hash=password_hash,
            base_currency=base_currency,
        )
        session.add(user)
        await session.flush()
        return user

    @staticmethod
    async def get_by_email(session: AsyncSession, email: str) -> User | None:
        result = await session.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id(session: AsyncSession, user_id: str) -> User | None:
        result = await session.execute(
            select(User).where(User.id == UUID(user_id))
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update_password(session: AsyncSession, user: User, new_hash: str) -> User:
        user.password_hash = new_hash
        await session.flush()
        return user

    @staticmethod
    async def update_display_name(session: AsyncSession, user: User, display_name: str) -> User:
        user.display_name = display_name
        await session.flush()
        return user

    @staticmethod
    async def update_base_currency(session: AsyncSession, user: User, base_currency: str) -> User:
        user.base_currency = base_currency
        await session.flush()
        return user

    @staticmethod
    async def update_email(session: AsyncSession, user: User, new_email: str) -> User:
        """Atomically apply the confirmed new email and clear the pending_email field."""
        user.email = new_email.lower()
        user.pending_email = None
        await session.flush()
        return user

    @staticmethod
    async def set_pending_email(session: AsyncSession, user: User, pending_email: str) -> User:
        """Mark *pending_email* on the user record while the confirmation link is outstanding."""
        user.pending_email = pending_email.lower()
        await session.flush()
        return user
