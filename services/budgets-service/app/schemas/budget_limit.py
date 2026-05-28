import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class BudgetLimitResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    expense_category_id: uuid.UUID
    amount: Decimal
    created_at: datetime
    updated_at: datetime


class UpsertBudgetLimitRequest(BaseModel):
    amount: float

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be greater than 0")
        return v
