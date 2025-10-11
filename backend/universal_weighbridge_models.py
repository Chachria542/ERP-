"""
Universal Weighbridge System - Database Models
Supports multiple transaction types: Farmer Purchase, Bill Purchase, Sale, Custody, Transfer
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
from enum import Enum
import uuid

# ============= ENUMS =============

class TransactionType(str, Enum):
    FARMER_PURCHASE = "farmer_purchase"
    BILL_PURCHASE = "bill_purchase"
    SALE = "sale"
    CUSTODY_DEPOSIT = "custody_deposit"
    CUSTODY_WITHDRAWAL = "custody_withdrawal"
    INTERNAL_TRANSFER = "internal_transfer"

class PartyType(str, Enum):
    FARMER = "farmer"
    TRADER = "trader"
    BUYER = "buyer"
    OWN_STOCK = "own_stock"

class PreEntryStatus(str, Enum):
    PENDING = "pending"
    WEIGHED = "weighed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class WeighbridgeStatus(str, Enum):
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PhotoUploadStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"

# ============= FARMER MASTER =============

class Farmer(BaseModel):
    """Farmer master record"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mobile: str  # Unique identifier
    name: str
    city: Optional[str] = None
    aadhaar: Optional[str] = None
    mobile_verified: bool = False
    mobile_verified_at: Optional[datetime] = None
    otp_verified_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class FarmerCreate(BaseModel):
    mobile: str
    name: str
    city: Optional[str] = None
    aadhaar: Optional[str] = None

# ============= PRE-ENTRY MODELS (Office Side - Before Weighbridge) =============

class PreEntry(BaseModel):
    """
    Pre-Entry created by office staff BEFORE truck arrives at weighbridge.
    Contains party, item, and expected quantity info. NO WEIGHTS yet.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slip_id: str  # WB-YY-###### (unique, indexed)
    qr_code: str  # QR code data for scanning
    
    # Transaction details
    transaction_type: TransactionType
    
    # Location
    from_location: str  # Warehouse/Mandi name
    to_location: Optional[str] = None  # For transfers
    
    # Party details (dynamic based on transaction type)
    party_type: PartyType
    party_id: Optional[str] = None  # FK to farmers/suppliers/buyers
    party_name: str
    party_mobile: Optional[str] = None
    party_gstin: Optional[str] = None  # For bill purchases
    
    # Item details
    item_id: str
    item_name: str
    quality: Optional[str] = None  # Grade A, B, C
    expected_bags: Optional[int] = None  # Estimated quantity
    
    # Rate (for purchases/sales)
    rate_per_qtl: Optional[float] = None
    
    # Additional fields based on transaction type
    po_number: Optional[str] = None  # For bill purchases
    order_number: Optional[str] = None  # For sales
    challan_number: Optional[str] = None  # For transfers
    pledge_rate: Optional[float] = None  # For custody deposits
    
    # Metadata
    remarks: Optional[str] = None
    status: PreEntryStatus = PreEntryStatus.PENDING
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class PreEntryCreate(BaseModel):
    """Request model for creating pre-entry"""
    transaction_type: TransactionType
    from_location: str
    to_location: Optional[str] = None
    
    party_type: PartyType
    party_name: str
    party_mobile: Optional[str] = None
    party_gstin: Optional[str] = None
    
    item_id: str
    quality: Optional[str] = None
    expected_bags: Optional[int] = None
    rate_per_qtl: Optional[float] = None
    
    po_number: Optional[str] = None
    order_number: Optional[str] = None
    challan_number: Optional[str] = None
    pledge_rate: Optional[float] = None
    
    remarks: Optional[str] = None
    created_by: str

# ============= WEIGHBRIDGE ENTRY MODELS (Operator Side - At Weighbridge) =============

class WeighbridgeEntry(BaseModel):
    """
    Weighbridge Entry created by operator AFTER scanning QR and weighing truck.
    Contains actual weights and photos. Links to PreEntry.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pre_entry_id: str  # FK to pre_entries
    slip_id: str  # Same as pre_entry.slip_id (for easy lookup)
    transaction_type: TransactionType  # Copied from pre_entry for routing
    
    # Vehicle details
    vehicle_number: str
    vehicle_type: str  # Truck, Tractor, Hammali
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    
    # Actual weights (recorded at weighbridge)
    gross_weight: float  # kg
    tare_weight: float  # kg
    net_weight: float  # Calculated: gross - tare
    
    # Calculated quantities
    bags: int  # net_weight // 100
    rem_kg: int  # net_weight % 100
    act_qtl: float  # net_weight / 100
    
    # Photos (two weighment photos)
    photo_gross_url: str
    photo_gross_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    photo_tare_url: str
    photo_tare_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    photo_upload_status: PhotoUploadStatus = PhotoUploadStatus.PENDING
    
    # Operator details
    operator_id: str
    operator_name: str
    shift: Optional[str] = None  # Morning, Evening, Night
    
    # Payment tracking (for downstream processing)
    payment_status: str = "pending_payment"  # "pending_payment" | "payment_completed" | "payment_cancelled"
    
    # Photo approval tracking
    photo_approval_status: str = "pending"  # "pending" | "approved" | "rejected"
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    # Metadata
    status: WeighbridgeStatus = WeighbridgeStatus.COMPLETED
    weighed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WeighbridgeEntryCreate(BaseModel):
    """Request model for creating weighbridge entry"""
    slip_id: str  # Scanned from QR or manually entered
    
    vehicle_number: str
    vehicle_type: str
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    
    gross_weight: float
    tare_weight: float
    
    operator_id: str
    operator_name: str
    shift: Optional[str] = None

# ============= AUDIT LOG =============

class AuditLog(BaseModel):
    """Audit trail for all changes"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    action: str  # create, edit, delete, approve, settle, cancel
    entity_type: str  # pre_entry, weighbridge_entry, farmer_payment, farmer
    entity_id: str
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= HELPER FUNCTIONS =============

def calculate_quantities(net_weight: float) -> dict:
    """Calculate bags, rem_kg, and quintals from net weight"""
    bags = int(net_weight // 100)
    rem_kg = int(net_weight % 100)
    act_qtl = round(net_weight / 100, 2)
    return {
        "bags": bags,
        "rem_kg": rem_kg,
        "act_qtl": act_qtl
    }

def generate_qr_code_data(slip_id: str, transaction_type: TransactionType) -> str:
    """Generate QR code data string"""
    return f"SLIP:{slip_id}|TYPE:{transaction_type.value}"
