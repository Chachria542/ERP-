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

# ============= OTP VERIFICATION MODELS =============

class OTPVerification(BaseModel):
    """OTP verification for mobile numbers"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mobile: str
    otp: str  # 4-digit OTP (stored hashed in production)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime  # 2 minutes from creation
    verified: bool = False
    attempts: int = 0
    max_attempts: int = 5
    last_resend_at: Optional[datetime] = None

class OTPSendRequest(BaseModel):
    mobile: str

class OTPVerifyRequest(BaseModel):
    mobile: str
    otp: str

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

class WeightType(str, Enum):
    """Weight type for sales flow (tare first, then gross)"""
    SINGLE = "single"  # Single weighment (gross and tare together) - for purchase
    TARE = "tare"  # Tare weight only (empty vehicle) - for sales
    GROSS = "gross"  # Gross weight only (loaded vehicle) - for sales

class WeighbridgeEntry(BaseModel):
    """
    Weighbridge Entry created by operator AFTER scanning QR and weighing truck.
    Contains actual weights and photos. Links to PreEntry.
    For sales: creates two entries (tare + gross), for purchases: one entry (single)
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pre_entry_id: str  # FK to pre_entries
    slip_id: str  # Same as pre_entry.slip_id (for easy lookup)
    transaction_type: TransactionType  # Copied from pre_entry for routing
    weight_type: str = "single"  # "single", "tare", or "gross"
    
    # Vehicle details
    vehicle_number: str
    vehicle_type: str  # Truck, Tractor, Hammali
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    
    # Actual weights (recorded at weighbridge)
    # For single: both gross and tare filled
    # For tare: only tare_weight filled, gross_weight = 0
    # For gross: only gross_weight filled, tare_weight = 0
    gross_weight: float = 0.0  # kg
    tare_weight: float = 0.0  # kg
    net_weight: float = 0.0  # Calculated: gross - tare (only for single or when both exist)
    weight: float = 0.0  # The actual measured weight (tare OR gross depending on weight_type)
    
    # Calculated quantities
    bags: int  # net_weight // 100
    rem_kg: int  # net_weight % 100
    act_qtl: float  # net_weight / 100
    
    # Photos (two weighment photos for single, one photo for tare/gross)
    photo_gross_url: Optional[str] = None
    photo_gross_timestamp: Optional[datetime] = None
    photo_tare_url: Optional[str] = None
    photo_tare_timestamp: Optional[datetime] = None
    photo_url: Optional[str] = None  # Single photo URL (for tare or gross type)
    photo_timestamp: Optional[datetime] = None  # Single photo timestamp
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
    weight_type: str = "single"  # "single", "tare", or "gross"
    
    vehicle_number: str
    vehicle_type: str
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    
    # For single: both required
    # For tare: only weight (measured tare)
    # For gross: only weight (measured gross)
    gross_weight: float = 0.0
    tare_weight: float = 0.0
    weight: float = 0.0  # The measured weight (for tare or gross type)
    
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
