from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget_limit import BudgetLimit


class BudgetLimitRepository:
    @staticmethod
    async def get_by_user(user_id: str, session: AsyncSession) -> list[BudgetLimit]:
        """Return all budget limits owned by *user_id*, ordered by creation date."""
        result = await session.execute(
            select(BudgetLimit)
            .where(BudgetLimit.user_id == UUID(user_id))
            .order_by(BudgetLimit.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def upsert(
        user_id: str,
        expense_category_id: str,
        amount: Decimal,
        session: AsyncSession,
    ) -> BudgetLimit:
        """Insert a budget limit or update the amount if one already exists for the user/category pair."""
        stmt = (
            insert(BudgetLimit)
            .values(
                user_id=UUID(user_id),
                expense_category_id=UUID(expense_category_id),
                amount=amount,
            )
            .on_conflict_do_update(
                constraint="uq_budget_limit_user_category",
                set_={"amount": amount, "updated_at": __import__("sqlalchemy").func.now()},
            )
            .returning(BudgetLimit)
        )
        result = await session.execute(stmt)
        row = result.scalar_one()
        return row

    @staticmethod
    async def get_by_user_and_category(
        user_id: str,
        expense_category_id: str,
        session: AsyncSession,
    ) -> BudgetLimit | None:
        """Return the budget limit for a specific user/category pair, or None."""
        result = await session.execute(
            select(BudgetLimit)
            .where(BudgetLimit.user_id == UUID(user_id))
            .where(BudgetLimit.expense_category_id == UUID(expense_category_id))
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def delete(row: BudgetLimit, session: AsyncSession) -> None:
        """Delete a budget limit row and flush."""
        await session.delete(row)
        await session.flush()
