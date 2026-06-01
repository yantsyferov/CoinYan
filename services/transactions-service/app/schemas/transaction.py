import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class CreateTransactionRequest(BaseModel):
    type: Literal["expense", "income"]
    amount: Decimal
    account_amount: Optional[Decimal] = None
    account_currency: str = "USD"
    exchange_rate: Decimal = Decimal("1.0")
    source_currency: str = "USD"
    target_currency: str = "USD"
    rate_is_custom: bool = False
    account_id: uuid.UUID
    expense_category_id: Optional[uuid.UUID] = None
    income_source_id: Optional[uuid.UUID] = None
    note: Optional[str] = None
    transaction_date: date = Field(default_factory=date.today)
    base_currency_code: Optional[str] = None
    base_currency_rate: Optional[Decimal] = None
    base_currency_amount: Optional[Decimal] = None

    @field_validator("amount", "exchange_rate")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("must be greater than zero")
        return v

    @field_validator("transaction_date")
    @classmethod
    def transaction_date_not_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("transaction_date cannot be in the future")
        return v

    @model_validator(mode="after")
    def validate_type_fields(self) -> "CreateTransactionRequest":
        if self.type == "expense":
            if self.expense_category_id is None:
                raise ValueError("expense_category_id is required for expense transactions")
            if self.income_source_id is not None:
                raise ValueError("income_source_id must be null for expense transactions")
        else:
            if self.expense_category_id is not None:
                raise ValueError("expense_category_id must be null for income transactions")
        return self


class CreateTransferTransactionRequest(BaseModel):
    from_account_id: uuid.UUID
    to_account_id: uuid.UUID
    from_amount: Decimal
    to_amount: Decimal
    from_currency: str = "USD"
    to_currency: str = "USD"
    exchange_rate: Decimal = Decimal("1.0")
    note: Optional[str] = None
    user_id: Optional[str] = None
    transaction_date: date = Field(default_factory=date.today)
    base_currency_code: Optional[str] = None
    base_currency_rate: Optional[Decimal] = None
    base_currency_amount: Optional[Decimal] = None

    @field_validator("from_amount", "to_amount", "exchange_rate")
    @classmethod
    def amounts_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("must be greater than zero")
        return v

    @field_validator("transaction_date")
    @classmethod
    def transaction_date_not_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("transaction_date cannot be in the future")
        return v

    @model_validator(mode="after")
    def validate_accounts_differ(self) -> "CreateTransferTransactionRequest":
        if self.from_account_id == self.to_account_id:
            raise ValueError("from_account_id and to_account_id must be different")
        return self


class TransactionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    type: Literal["expense", "income", "transfer"]
    amount: Decimal
    account_amount: Decimal
    account_currency: str
    exchange_rate: Decimal
    source_currency: str
    target_currency: str
    rate_is_custom: bool
    account_id: uuid.UUID
    expense_category_id: Optional[uuid.UUID] = None
    income_source_id: Optional[uuid.UUID] = None
    note: Optional[str] = None
    created_at: datetime
    transaction_date: date
    transfer_to_account_id: Optional[uuid.UUID] = None
    transfer_peer_id: Optional[uuid.UUID] = None
    from_account_id: Optional[uuid.UUID] = None
    base_currency_code: Optional[str] = None
    base_currency_rate: Optional[Decimal] = None
    base_currency_amount: Optional[Decimal] = None


class UpdateTransactionRequest(BaseModel):
    amount: Decimal
    note: Optional[str] = None
    transaction_date: Optional[date] = None
    exchange_rate: Optional[Decimal] = None
    account_amount: Optional[Decimal] = None
    rate_is_custom: Optional[bool] = None
    base_currency_rate: Optional[Decimal] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("must be greater than zero")
        return v

    @field_validator("transaction_date")
    @classmethod
    def transaction_date_not_future(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v > date.today():
            raise ValueError("transaction_date cannot be in the future")
        return v


class UpdateTransactionResponse(BaseModel):
    transaction: TransactionResponse
    old_account_amount: Decimal
    peer_transaction: Optional[TransactionResponse] = None
    old_peer_account_amount: Optional[Decimal] = None


class CumulativeBalanceResponse(BaseModel):
    cumulative_balance: float | None = None


class CurrencyTotal(BaseModel):
    currency: str
    amount: float


class TotalsByCurrencyResponse(BaseModel):
    totals: list[CurrencyTotal]


class LatestRateResponse(BaseModel):
    account_id: str
    base_currency_code: str
    rate: Optional[Decimal] = None
