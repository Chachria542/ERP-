"""
Broker Master Data Models
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import uuid

class Broker(BaseModel):
    """Broker master record"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    default_brokerage_type: Optional[str] = "per_quintal"  # per_quintal, per_bag, percentage
    default_brokerage_rate: Optional[float] = 0.0
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class BrokerCreate(BaseModel):
    """Request model for creating broker"""
    name: str
    contact: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    default_brokerage_type: Optional[str] = "per_quintal"
    default_brokerage_rate: Optional[float] = 0.0
    active: bool = True
