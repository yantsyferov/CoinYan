from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense_category import ExpenseCategory
from app.repositories.expense_category_repo import ExpenseCategoryRepository

DEFAULTS = [
    {"name": "Groceries", "icon": "cash"},
    {"name": "Rent", "icon": "bank"},
    {"name": "Transport", "icon": "card"},
    {"name": "Dining Out", "icon": "cash"},
    {"name": "Entertainment", "icon": "wallet"},
    {"name": "Healthcare", "icon": "savings"},
    {"name": "Utilities", "icon": "piggybank"},
    {"name": "Shopping", "icon": "card"},
    {"name": "Education", "icon": "savings"},
]


class ExpenseCategoryService:
    @staticmethod
    async def get_or_seed(
        user_id: str,
        session: AsyncSession,
    ) -> list[ExpenseCategory]:
        """Return the user's expense categories, seeding defaults on first access.

        If the user has no categories yet, a standard set is inserted in bulk
        (duplicates silently ignored via ON CONFLICT DO NOTHING) and the list
        is re-fetched so all DB-generated fields are populated before returning.
        """
        categories = await ExpenseCategoryRepository.get_by_user(user_id, session)

        if not categories:
            await ExpenseCategoryRepository.bulk_create(user_id, DEFAULTS, session)
            await session.flush()
            categories = await ExpenseCategoryRepository.get_by_user(user_id, session)

        return categories

    @staticmethod
    async def create(user_id: str, name: str, icon: str, session: AsyncSession, currency: str = "USD") -> ExpenseCategory:
        from fastapi import HTTPException
        from sqlalchemy.exc import IntegrityError
        try:
            return await ExpenseCategoryRepository.create(user_id, name, icon, session, currency=currency)
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=409, detail="A category with this name already exists")

    @staticmethod
    async def update(user_id: str, id: str, name: str, icon: str, session: AsyncSession, currency: str | None = None) -> ExpenseCategory:
        from fastapi import HTTPException
        from sqlalchemy.exc import IntegrityError
        row = await ExpenseCategoryRepository.get_by_id(id, user_id, session)
        if not row:
            raise HTTPException(status_code=404, detail="Expense category not found")
        try:
            return await ExpenseCategoryRepository.update(row, name, icon, session, currency=currency)
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=409, detail="A category with this name already exists")

    @staticmethod
    async def delete(user_id: str, id: str, session: AsyncSession) -> None:
        from fastapi import HTTPException
        row = await ExpenseCategoryRepository.get_by_id(id, user_id, session)
        if not row:
            raise HTTPException(status_code=404, detail="Expense category not found")
        await ExpenseCategoryRepository.delete(row, session)
