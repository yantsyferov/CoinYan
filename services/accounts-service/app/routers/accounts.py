from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_user_id
from app.schemas.account import (
    AccountResponse,
    CreateAccountRequest,
    DeleteAccountRequest,
    UpdateAccountRequest,
)
from app.services.account_service import AccountService

router = APIRouter(prefix="/internal/accounts", tags=["Accounts"], redirect_slashes=False)


@router.get(
    "",
    response_model=list[AccountResponse],
    status_code=status.HTTP_200_OK,
    summary="List accounts",
    description="Return all active accounts for the authenticated user, seeding a default Cash account on first access.",
)
async def list_accounts(
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[AccountResponse]:
    accounts = await AccountService.get_or_seed_accounts(session, user_id)
    return accounts


# NOTE: This route MUST be declared before GET /{account_id} so FastAPI does not
# swallow the literal path segment "archived" as an account_id parameter.
@router.get(
    "/archived",
    response_model=list[AccountResponse],
    status_code=status.HTTP_200_OK,
    summary="List recoverable accounts",
    description="Return all soft-deleted or archived accounts still within the 30-day recovery window.",
)
async def list_archived_accounts(
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[AccountResponse]:
    return await AccountService.get_recoverable_accounts(session, user_id)


@router.get(
    "/{account_id}",
    response_model=AccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Get account",
)
async def get_account(
    account_id: str,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> AccountResponse:
    account = await AccountService.get_account(session, account_id, user_id)
    return account


@router.patch(
    "/{account_id}",
    response_model=AccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Update account name and icon",
)
async def update_account(
    account_id: str,
    body: UpdateAccountRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> AccountResponse:
    account = await AccountService.update_account(session, account_id, user_id, body.name, body.icon)
    return account


@router.patch(
    "/{account_id}/balance",
    response_model=AccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Adjust account balance",
)
async def adjust_balance(
    account_id: str,
    body: dict,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> AccountResponse:
    from decimal import Decimal
    delta = body.get("delta", 0)
    return await AccountService.adjust_balance(session, account_id, user_id, Decimal(str(delta)))


@router.post(
    "",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create account",
)
async def create_account(
    body: CreateAccountRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> AccountResponse:
    account = await AccountService.create_account(
        session, user_id, body.name, body.icon, body.currency, body.starting_balance
    )
    return account


@router.post(
    "/{account_id}/archive",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive account",
)
async def archive_account(
    account_id: str,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> None:
    await AccountService.archive_account(session, account_id, user_id)


@router.post(
    "/{account_id}/delete",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete account",
)
async def delete_account(
    account_id: str,
    body: DeleteAccountRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> None:
    await AccountService.delete_account(session, account_id, user_id, body.option)


@router.post(
    "/{account_id}/restore",
    response_model=AccountResponse,
    status_code=status.HTTP_200_OK,
    summary="Restore account",
)
async def restore_account(
    account_id: str,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> AccountResponse:
    account = await AccountService.restore_account_by_id(session, account_id, user_id)
    return account
