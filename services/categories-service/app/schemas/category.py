import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class CategoryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    icon: str
    created_at: datetime
    updated_at: datetime


class CreateCategoryRequest(BaseModel):
    name: str
    icon: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
        return v

    @field_validator("icon")
    @classmethod
    def icon_valid(cls, v: str) -> str:
        from app.core.constants import VALID_ICONS
        if v not in VALID_ICONS:
            raise ValueError(f"icon must be one of {sorted(VALID_ICONS)}")
        return v


class UpdateCategoryRequest(BaseModel):
    name: str
    icon: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
        return v

    @field_validator("icon")
    @classmethod
    def icon_valid(cls, v: str) -> str:
        from app.core.constants import VALID_ICONS
        if v not in VALID_ICONS:
            raise ValueError(f"icon must be one of {sorted(VALID_ICONS)}")
        return v
