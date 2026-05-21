import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class AccountResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    icon: str
    currency: str
    current_balance: Decimal
    status: str
    deleted_at: datetime | None
    created_at: datetime


class CreateAccountRequest(BaseModel):
    name: str
    icon: str
    currency: str
    starting_balance: Decimal = Decimal("0")

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v.strip()

    @field_validator("icon")
    @classmethod
    def icon_valid(cls, v: str) -> str:
        from app.core.constants import VALID_ICONS
        if v not in VALID_ICONS:
            raise ValueError(f"icon must be one of: {', '.join(sorted(VALID_ICONS))}")
        return v

    @field_validator("currency")
    @classmethod
    def currency_valid(cls, v: str) -> str:
        from app.core.constants import VALID_CURRENCIES
        if v.upper() not in VALID_CURRENCIES:
            raise ValueError(f"'{v}' is not a valid ISO 4217 currency code")
        return v.upper()

    @field_validator("starting_balance")
    @classmethod
    def balance_non_negative(cls, v: Decimal) -> Decimal:
        if v < Decimal("0"):
            raise ValueError("starting_balance must be >= 0")
        return v


class UpdateAccountRequest(BaseModel):
    name: str
    icon: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v.strip()

    @field_validator("icon")
    @classmethod
    def icon_valid(cls, v: str) -> str:
        from app.core.constants import VALID_ICONS
        if v not in VALID_ICONS:
            raise ValueError(f"icon must be one of: {', '.join(sorted(VALID_ICONS))}")
        return v


class DeleteAccountRequest(BaseModel):
    option: str  # "keep_history" or "delete_all"

    @field_validator("option")
    @classmethod
    def option_valid(cls, v: str) -> str:
        if v not in ("keep_history", "delete_all"):
            raise ValueError("option must be 'keep_history' or 'delete_all'")
        return v
