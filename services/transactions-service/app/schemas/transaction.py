import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, field_validator, model_validator


class CreateTransactionRequest(BaseModel):
    type: Literal["expense", "income"]
    amount: Decimal
    account_amount: Optional[Decimal] = None
    account_currency: str = "USD"
    exchange_rate: Decimal = Decimal("1.0")
    account_id: uuid.UUID
    expense_category_id: Optional[uuid.UUID] = None
    income_source_id: Optional[uuid.UUID] = None
    note: Optional[str] = None

    @field_validator("amount", "exchange_rate")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("must be greater than zero")
        return v

    @model_validator(mode="after")
    def validate_type_fields(self) -> "CreateTransactionRequest":
        if self.type == "expense":
            if self.expense_category_id is None:
                raise ValueError("expense_category_id is required for expense transactions")
            if self.income_source_id is not None:
                raise ValueError("income_source_id must be null for expense transactions")
        else:
            if self.income_source_id is None:
                raise ValueError("income_source_id is required for income transactions")
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

    @field_validator("from_amount", "to_amount", "exchange_rate")
    @classmethod
    def amounts_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("must be greater than zero")
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
    account_id: uuid.UUID
    expense_category_id: Optional[uuid.UUID] = None
    income_source_id: Optional[uuid.UUID] = None
    note: Optional[str] = None
    created_at: datetime
    transfer_to_account_id: Optional[uuid.UUID] = None
    transfer_peer_id: Optional[uuid.UUID] = None
    from_account_id: Optional[uuid.UUID] = None
