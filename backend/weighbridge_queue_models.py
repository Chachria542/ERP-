"""
Weighbridge Queue Models
Universal queue for all weighbridge operations
"""
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class WeighbridgeQueueItem(BaseModel):
    """Universal queue item for weighbridge entries"""
    # Core identifiers
    pre_entry_id: str
    slip_id: str
    pre_entry_number: str
    transaction_type: Literal['farmer_purchase', 'bill_purchase', 'sale']
    
    # Party/Customer info
    party_name: str  # Could be farmer, supplier, or customer
    party_mobile: Optional[str] = None
    
    # Item details
    item_name: Optional[str] = None
    item_id: Optional[str] = None
    
    # Weight status
    tare_weight: Optional[float] = None
    gross_weight: Optional[float] = None
    net_weight: Optional[float] = None
    
    # Vehicle details (if already captured)
    vehicle_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    
    # Status tracking
    status: str  # e.g., 'pending', 'tare_completed', 'weighed'
    tare_pending: bool  # True if TARE weight needs to be captured
    gross_pending: bool  # True if GROSS weight needs to be captured
    next_action: Literal['tare', 'gross', 'complete']  # What action is next
    
    # Metadata
    created_at: datetime
    date: str  # Date of pre-entry


class WeighbridgeQueueResponse(BaseModel):
    """Response model for weighbridge queue"""
    total: int
    queue: list[WeighbridgeQueueItem]
