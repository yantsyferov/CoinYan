from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.income_source import IncomeSource


class IncomeSourceRepository:
    @staticmethod
    async def get_by_user(user_id: str, session: AsyncSession) -> list[IncomeSource]:
        """Return all income sources owned by *user_id*, ordered by creation date."""
        result = await session.execute(
            select(IncomeSource)
            .where(IncomeSource.user_id == UUID(user_id))
            .order_by(IncomeSource.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create(user_id: str, name: str, icon: str, session: AsyncSession, currency: str = "USD") -> IncomeSource:
        row = IncomeSource(user_id=UUID(user_id), name=name, icon=icon, currency=currency)
        session.add(row)
        await session.flush()
        return row

    @staticmethod
    async def get_by_id(id: str, user_id: str, session: AsyncSession) -> IncomeSource | None:
        """Return a single income source owned by *user_id*, or None."""
        result = await session.execute(
            select(IncomeSource)
            .where(IncomeSource.id == UUID(id))
            .where(IncomeSource.user_id == UUID(user_id))
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update(row: IncomeSource, name: str, icon: str, session: AsyncSession, currency: str | None = None) -> IncomeSource:
        """Update name, icon, and optionally currency on an existing row, flush, and return it."""
        row.name = name
        row.icon = icon
        if currency is not None:
            row.currency = currency
        await session.flush()
        return row

    @staticmethod
    async def delete(row: IncomeSource, session: AsyncSession) -> None:
        """Delete an income source row and flush."""
        await session.delete(row)
        await session.flush()
