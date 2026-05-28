from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_user_id
from app.repositories.budget_limit_repository import BudgetLimitRepository
from app.schemas.budget_limit import BudgetLimitResponse, UpsertBudgetLimitRequest

router = APIRouter(
    prefix="/internal/budget-limits",
    tags=["Budget Limits"],
    redirect_slashes=False,
)


@router.get(
    "",
    response_model=list[BudgetLimitResponse],
    status_code=status.HTTP_200_OK,
    summary="List budget limits",
    description="Return all budget limits for the authenticated user.",
)
async def list_budget_limits(
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[BudgetLimitResponse]:
    return await BudgetLimitRepository.get_by_user(user_id, session)


@router.put(
    "/{category_id}",
    response_model=BudgetLimitResponse,
    status_code=status.HTTP_200_OK,
    summary="Upsert budget limit",
    description="Create or update the budget limit for a specific expense category.",
)
async def upsert_budget_limit(
    category_id: str,
    body: UpsertBudgetLimitRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> BudgetLimitResponse:
    return await BudgetLimitRepository.upsert(
        user_id=user_id,
        expense_category_id=category_id,
        amount=Decimal(str(body.amount)),
        session=session,
    )


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete budget limit",
    description="Remove the budget limit for a specific expense category.",
)
async def delete_budget_limit(
    category_id: str,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> None:
    row = await BudgetLimitRepository.get_by_user_and_category(user_id, category_id, session)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget limit not found",
        )
    await BudgetLimitRepository.delete(row, session)
