from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_user_id
from app.repositories.income_source_repo import IncomeSourceRepository
from app.schemas.category import CategoryResponse, CreateCategoryRequest, UpdateCategoryRequest
from app.services.income_source_service import IncomeSourceService

router = APIRouter(
    prefix="/internal/income-sources",
    tags=["Income Sources"],
    redirect_slashes=False,
)


@router.get(
    "",
    response_model=list[CategoryResponse],
    status_code=status.HTTP_200_OK,
    summary="List income sources",
    description="Return all income sources for the authenticated user.",
)
async def list_income_sources(
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[CategoryResponse]:
    return await IncomeSourceRepository.get_by_user(user_id, session)


@router.post(
    "",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create income source",
    description="Create a new income source for the authenticated user.",
)
async def create_income_source(
    body: CreateCategoryRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    return await IncomeSourceService.create(session=session, user_id=user_id, name=body.name, icon=body.icon, currency=body.currency)


@router.get(
    "/{id}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get income source",
    description="Return a single income source by ID for the authenticated user.",
)
async def get_income_source(
    id: str,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    row = await IncomeSourceRepository.get_by_id(id, user_id, session)
    if not row:
        raise HTTPException(status_code=404, detail="Income source not found")
    return row


@router.patch(
    "/{id}",
    response_model=CategoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Update income source",
    description="Update the name and icon of an income source for the authenticated user.",
)
async def update_income_source(
    id: str,
    body: UpdateCategoryRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> CategoryResponse:
    return await IncomeSourceService.update(user_id=user_id, id=id, name=body.name, icon=body.icon, session=session, currency=body.currency)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete income source",
    description="Delete an income source owned by the authenticated user.",
)
async def delete_income_source(
    id: str,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> None:
    await IncomeSourceService.delete(user_id=user_id, id=id, session=session)
