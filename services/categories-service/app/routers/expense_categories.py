from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_user_id
from app.repositories.expense_category_repo import ExpenseCategoryRepository
from app.schemas.category import CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest
from app.services.expense_category_service import ExpenseCategoryService

router = APIRouter(
    prefix="/internal/expense-categories",
    tags=["Expense Categories"],
    redirect_slashes=False,
)


@router.get(
    "",
    response_model=list[CategoryResponse],
    status_code=status.HTTP_200_OK,
    summary="List expense categories",
    description="Return all expense categories for the authenticated user, seeding defaults on first access.",
)
async def list_expense_categories(
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[CategoryResponse]:
    return await ExpenseCategoryService.get_or_seed(user_id, session)


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create expense category",
    description="Create a new expense category for the authenticated user.",
)
async def create_expense_category(
    body: CreateCategoryRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    return await ExpenseCategoryService.create(session=session, user_id=user_id, name=body.name, icon=body.icon)


@router.get(
    "/{id}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get expense category",
    description="Return a single expense category by ID for the authenticated user.",
)
async def get_expense_category(
    id: str,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    row = await ExpenseCategoryRepository.get_by_id(id, user_id, session)
    if not row:
        raise HTTPException(status_code=404, detail="Expense category not found")
    return row


@router.patch(
    "/{id}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Update expense category",
    description="Update the name and icon of an expense category for the authenticated user.",
)
async def update_expense_category(
    id: str,
    body: UpdateCategoryRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    return await ExpenseCategoryService.update(user_id=user_id, id=id, name=body.name, icon=body.icon, session=session)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete expense category",
    description="Delete an expense category owned by the authenticated user.",
)
async def delete_expense_category(
    id: str,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> None:
    await ExpenseCategoryService.delete(user_id=user_id, id=id, session=session)
