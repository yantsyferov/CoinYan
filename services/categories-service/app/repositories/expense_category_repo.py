from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense_category import ExpenseCategory


class ExpenseCategoryRepository:
    @staticmethod
    async def get_by_user(user_id: str, session: AsyncSession) -> list[ExpenseCategory]:
        """Return all expense categories owned by *user_id*, ordered by creation date."""
        result = await session.execute(
            select(ExpenseCategory)
            .where(ExpenseCategory.user_id == UUID(user_id))
            .order_by(ExpenseCategory.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def bulk_create(
        user_id: str,
        items: list[dict],
        session: AsyncSession,
    ) -> None:
        """Insert multiple expense categories, silently ignoring duplicate names."""
        values = [
            {"user_id": UUID(user_id), "name": item["name"], "icon": item["icon"]}
            for item in items
        ]
        await session.execute(
            insert(ExpenseCategory).values(values).on_conflict_do_nothing()
        )

    @staticmethod
    async def create(user_id: str, name: str, icon: str, session: AsyncSession, currency: str = "USD") -> ExpenseCategory:
        row = ExpenseCategory(user_id=UUID(user_id), name=name, icon=icon, currency=currency)
        session.add(row)
        await session.flush()
        return row

    @staticmethod
    async def get_by_id(id: str, user_id: str, session: AsyncSession) -> ExpenseCategory | None:
        """Return a single expense category owned by *user_id*, or None."""
        result = await session.execute(
            select(ExpenseCategory)
            .where(ExpenseCategory.id == UUID(id))
            .where(ExpenseCategory.user_id == UUID(user_id))
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def update(row: ExpenseCategory, name: str, icon: str, session: AsyncSession, currency: str | None = None) -> ExpenseCategory:
        """Update name, icon, and optionally currency on an existing row, flush, and return it."""
        row.name = name
        row.icon = icon
        if currency is not None:
            row.currency = currency
        await session.flush()
        return row

    @staticmethod
    async def delete(row: ExpenseCategory, session: AsyncSession) -> None:
        """Delete an expense category row and flush."""
        await session.delete(row)
        await session.flush()
