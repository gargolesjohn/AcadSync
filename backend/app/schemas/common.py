"""Common/shared Pydantic schemas."""

from typing import Any, Optional
from pydantic import BaseModel


class SuccessResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: str = "Operation successful"


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    message: str
    details: Optional[dict] = None


class PaginatedResponse(BaseModel):
    success: bool = True
    data: dict
