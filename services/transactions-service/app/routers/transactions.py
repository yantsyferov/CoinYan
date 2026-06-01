import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_user_id
from app.repositories.transaction_repo import TransactionRepository
from app.schemas.transaction import (
    CreateTransactionRequest,
    CreateTransferTransactionRequest,
    CumulativeBalanceResponse,
    LatestRateResponse,
    TotalsByCurrencyResponse,
    TransactionResponse,
    UpdateTransactionRequest,
    UpdateTransactionResponse,
)

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
        source_currency=body.source_currency,
        target_currency=body.target_currency,
        rate_is_custom=body.rate_is_custom,
        account_id=str(body.account_id),
        expense_category_id=str(body.expense_category_id) if body.expense_category_id else None,
        income_source_id=str(body.income_source_id) if body.income_source_id else None,
        note=body.note,
        transaction_date=body.transaction_date,
        session=session,
        base_currency_code=body.base_currency_code,
        base_currency_rate=body.base_currency_rate,
        base_currency_amount=body.base_currency_amount,
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
        transaction_date=body.transaction_date,
        session=session,
    )
    return [TransactionResponse.model_validate(debit_leg), TransactionResponse.model_validate(credit_leg)]


@router.get("/balance", response_model=CumulativeBalanceResponse, status_code=status.HTTP_200_OK)
async def get_cumulative_balance(
    date_to: datetime = Query(...),
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> CumulativeBalanceResponse:
    result = await TransactionRepository.get_cumulative_balance(session, user_id, date_to)
    return CumulativeBalanceResponse(cumulative_balance=float(result) if result is not None else None)


@router.get("/totals", status_code=status.HTTP_200_OK)
async def get_totals(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    after_date: Optional[datetime] = Query(None),
    base_currency: str | None = Query(default=None),
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await TransactionRepository.get_totals(
        user_id=user_id,
        session=session,
        year=year,
        month=month,
        after_date=after_date,
        base_currency=base_currency,
    )


@router.get("/totals-by-currency", response_model=TotalsByCurrencyResponse, status_code=status.HTTP_200_OK)
async def get_totals_by_currency(
    entity_type: str = Query(..., description="'category' or 'income_source'"),
    entity_id: str = Query(..., description="UUID of the entity"),
    month: str = Query(..., description="Month in YYYY-MM format"),
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> TotalsByCurrencyResponse:
    if entity_type not in ("category", "income_source"):
        raise HTTPException(status_code=400, detail="entity_type must be 'category' or 'income_source'")
    rows = await TransactionRepository.get_totals_by_currency(
        session=session,
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        month=month,
    )
    return TotalsByCurrencyResponse(totals=[{"currency": c, "amount": a} for c, a in rows])


@router.get("", response_model=list[TransactionResponse], status_code=status.HTTP_200_OK)
async def list_transactions(
    account_id: Optional[str] = Query(None),
    expense_category_id: Optional[str] = Query(None),
    income_source_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
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
        limit=limit,
        offset=offset,
    )


@router.patch("/{transaction_id}", response_model=UpdateTransactionResponse, status_code=status.HTTP_200_OK)
async def update_transaction(
    transaction_id: str,
    body: UpdateTransactionRequest,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> UpdateTransactionResponse:
    txn = await TransactionRepository.get_by_id(transaction_id, user_id, session)
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    if txn.type == "transfer":
        target, peer, old_amount, old_peer_amount = await TransactionRepository.update_transfer_pair(
            transaction_id=uuid.UUID(transaction_id),
            user_id=uuid.UUID(user_id),
            amount=body.amount,
            note=body.note,
            session=session,
            transaction_date=body.transaction_date,
        )
        return UpdateTransactionResponse(
            transaction=TransactionResponse.model_validate(target),
            old_account_amount=old_amount,
            peer_transaction=TransactionResponse.model_validate(peer),
            old_peer_account_amount=old_peer_amount,
        )

    updated_txn, old_account_amount = await TransactionRepository.update_transaction(
        transaction_id=transaction_id,
        user_id=user_id,
        amount=body.amount,
        note=body.note,
        session=session,
        transaction_date=body.transaction_date,
        account_amount=body.account_amount,
        exchange_rate=body.exchange_rate,
        rate_is_custom=body.rate_is_custom,
        base_currency_rate=body.base_currency_rate,
    )
    return UpdateTransactionResponse(
        transaction=TransactionResponse.model_validate(updated_txn),
        old_account_amount=old_account_amount,
        peer_transaction=None,
        old_peer_account_amount=None,
    )


@router.get("/latest-rate", response_model=LatestRateResponse, status_code=status.HTTP_200_OK)
async def get_latest_rate(
    account_id: str = Query(..., description="Account UUID"),
    base_currency_code: str = Query(..., description="Base currency code, e.g. USD"),
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> LatestRateResponse:
    rate = await TransactionRepository.get_latest_rate(
        session=session,
        account_id=account_id,
        base_currency_code=base_currency_code,
    )
    return LatestRateResponse(
        account_id=account_id,
        base_currency_code=base_currency_code,
        rate=rate,
    )


@router.get("/{transaction_id}", response_model=TransactionResponse, status_code=status.HTTP_200_OK)
async def get_transaction(
    transaction_id: str,
    user_id: str = Depends(get_user_id),
    session: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    txn = await TransactionRepository.get_by_id(transaction_id, user_id, session)
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return TransactionResponse.model_validate(txn)


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
