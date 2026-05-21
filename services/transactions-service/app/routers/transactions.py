from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_user_id
from app.repositories.transaction_repo import TransactionRepository
from app.schemas.transaction import CreateTransactionRequest, CreateTransferTransactionRequest, TransactionResponse

router = APIRouter(prefix="/internal/transactions", tags=["Transactions"], redirect_slashes=False)


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: CreateTransactionRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    account_amount = body.account_amount if body.account_amount is not None else body.amount
    row = await TransactionRepository.create(
        user_id=user_id,
        type=body.type,
        amount=body.amount,
        account_amount=account_amount,
        account_currency=body.account_currency,
        exchange_rate=body.exchange_rate,
        account_id=str(body.account_id),
        expense_category_id=str(body.expense_category_id) if body.expense_category_id else None,
        income_source_id=str(body.income_source_id) if body.income_source_id else None,
        note=body.note,
        session=session,
    )
    return row


@router.post("/transfer", response_model=list[TransactionResponse], status_code=status.HTTP_201_CREATED)
async def create_transfer(
    body: CreateTransferTransactionRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[TransactionResponse]:
    debit_leg, credit_leg = await TransactionRepository.create_transfer_pair(
        user_id=user_id,
        data=body,
        session=session,
    )
    return [TransactionResponse.model_validate(debit_leg), TransactionResponse.model_validate(credit_leg)]


@router.get("/totals", status_code=status.HTTP_200_OK)
async def get_totals(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await TransactionRepository.get_totals(user_id=user_id, session=session, year=year, month=month)


@router.get("", response_model=list[TransactionResponse], status_code=status.HTTP_200_OK)
async def list_transactions(
    account_id: Optional[str] = Query(None),
    expense_category_id: Optional[str] = Query(None),
    income_source_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> list[TransactionResponse]:
    if not any([account_id, expense_category_id, income_source_id]):
        raise HTTPException(status_code=400, detail="At least one filter parameter is required")
    return await TransactionRepository.list_by_filter(
        user_id=user_id,
        session=session,
        account_id=account_id,
        expense_category_id=expense_category_id,
        income_source_id=income_source_id,
        year=year,
        month=month,
    )


@router.delete("/{transaction_id}", status_code=status.HTTP_200_OK)
async def delete_transaction(
    transaction_id: str,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict:
    txn = await TransactionRepository.get_by_id(transaction_id, user_id, session)
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    if txn.type == "transfer":
        return await TransactionRepository.delete_transfer_pair(
            transaction_id=transaction_id,
            user_id=user_id,
            session=session,
        )

    account_id = str(txn.account_id)
    delta = float(txn.account_amount) if txn.type == "expense" else -float(txn.account_amount)
    await session.delete(txn)
    await session.commit()
    return {"account_id": account_id, "delta": delta}
