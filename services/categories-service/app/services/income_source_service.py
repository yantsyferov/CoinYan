from sqlalchemy.ext.asyncio import AsyncSession

from app.models.income_source import IncomeSource
from app.repositories.income_source_repo import IncomeSourceRepository


class IncomeSourceService:
    @staticmethod
    async def create(user_id: str, name: str, icon: str, session: AsyncSession) -> IncomeSource:
        from fastapi import HTTPException
        from sqlalchemy.exc import IntegrityError
        try:
            return await IncomeSourceRepository.create(user_id, name, icon, session)
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=409, detail="An income source with this name already exists")

    @staticmethod
    async def update(user_id: str, id: str, name: str, icon: str, session: AsyncSession) -> IncomeSource:
        from fastapi import HTTPException
        from sqlalchemy.exc import IntegrityError
        row = await IncomeSourceRepository.get_by_id(id, user_id, session)
        if not row:
            raise HTTPException(status_code=404, detail="Income source not found")
        try:
            return await IncomeSourceRepository.update(row, name, icon, session)
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=409, detail="An income source with this name already exists")

    @staticmethod
    async def delete(user_id: str, id: str, session: AsyncSession) -> None:
        from fastapi import HTTPException
        row = await IncomeSourceRepository.get_by_id(id, user_id, session)
        if not row:
            raise HTTPException(status_code=404, detail="Income source not found")
        await IncomeSourceRepository.delete(row, session)
