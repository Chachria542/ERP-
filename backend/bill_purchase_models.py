"""
Bill Purchase Module - Database Models
Complete implementation with weighbridge integration and supplier management
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
from enum import Enum
import uuid

# ============= ENUMS =============

class BillPurchaseStatus(str, Enum):
    WEIGH_PENDING = "weigh_pending"
    PENDING = "pending"
    BILL_GENERATED = "bill_generated"
    CANCELLED = "cancelled"

class BrokerageType(str, Enum):
    PER_QUINTAL = "per_quintal"
    PER_BAG = "per_bag"
    PERCENTAGE = "percentage"
    NONE = "none"

# ============= EXTENDED PARTY MODELS =============

class PartyExtended(BaseModel):
    """Extended Party model with supplier fields and roles"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    roles: List[str] = Field(default_factory=list)  # ["supplier", "trader", "buyer", "farmer"]
    
    # Contact details
    contact: Optional[str] = None  # Mobile number
    address: Optional[str] = None
    
    # Business details
    gstin: Optional[str] = None
    state: Optional[str] = None
    place_of_supply: Optional[str] = None  # Free text field
    pan: Optional[str] = None
    
    # Banking details (optional)
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class PartyExtendedCreate(BaseModel):
    name: str
    roles: List[str] = Field(default_factory=list)
    contact: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    state: Optional[str] = None
    place_of_supply: Optional[str] = None
    pan: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None

class PartyExtendedUpdate(BaseModel):
    name: Optional[str] = None
    roles: Optional[List[str]] = None
    contact: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    state: Optional[str] = None
    place_of_supply: Optional[str] = None
    pan: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None

# ============= BILL PURCHASE PRE-ENTRY MODELS =============

class BillPurchasePreEntry(BaseModel):
    """
    Bill Purchase Pre-Entry created by office staff when truck arrives.
    Links to weighbridge system for weight capture and photo approval.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pre_entry_number: str  # BPRE-YY-######
    slip_id: str  # Same as pre_entry_number, used for weighbridge integration
    qr_code: str  # QR code data for scanning
    
    # Basic details
    date: str  # ISO date string (auto-filled with today)
    
    # Supplier details
    supplier_id: str  # FK to parties collection
    supplier_name: str  # Auto-filled from supplier
    supplier_gstin: Optional[str] = None  # Auto-filled but editable
    place_of_supply: str  # Required free text
    
    # Item details
    item_id: Optional[str] = None  # FK to items collection
    item_name: Optional[str] = None  # Auto-filled from item
    
    # Broker details
    has_broker: bool = False
    broker_name: Optional[str] = None
    brokerage_type: Optional[BrokerageType] = None
    brokerage_rate: Optional[float] = None
    
    # Document details
    eway_bill_no: Optional[str] = None
    expected_quantity_bags: Optional[int] = None
    expected_quantity_kgs: Optional[float] = None
    expected_quantity_qtls: Optional[float] = None
    remarks: Optional[str] = None
    
    # Status and tracking
    status: BillPurchaseStatus = BillPurchaseStatus.WEIGH_PENDING
    weighbridge_completed: bool = False
    weighbridge_slip_id: Optional[str] = None  # Links to weighbridge_entries
    
    # Metadata
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class BillPurchasePreEntryCreate(BaseModel):
    date: str
    supplier_id: str
    supplier_gstin: Optional[str] = None
    place_of_supply: str
    item_id: Optional[str] = None
    has_broker: bool = False
    broker_name: Optional[str] = None
    brokerage_type: Optional[BrokerageType] = None
    brokerage_rate: Optional[float] = None
    eway_bill_no: Optional[str] = None
    expected_quantity_bags: Optional[int] = None
    expected_quantity_kgs: Optional[float] = None
    expected_quantity_qtls: Optional[float] = None
    remarks: Optional[str] = None
    created_by: str

# ============= BILL PURCHASE MODELS =============

class BillPurchaseLineItem(BaseModel):
    """Individual line item in bill purchase"""
    item_id: str
    item_name: str
    quality: Optional[str] = None
    
    # Weight calculations
    pack_size: float  # Pack size in kg (e.g., 100, 50)
    bags: int  # Auto-calculated from total weight / pack_size
    remaining_kg: float  # Auto-calculated remainder
    actual_weight: float  # Exact weight from weighbridge (in quintals)
    agreed_weight: float  # Editable weight (defaults to actual_weight)
    
    # Pricing
    rate_per_qtl: float
    amount: float  # agreed_weight × rate_per_qtl
    
    # Taxes (mutually exclusive: CGST+SGST OR IGST)
    cgst_rate: float = 0.0
    sgst_rate: float = 0.0
    igst_rate: float = 0.0
    cgst_amount: float = 0.0
    sgst_amount: float = 0.0
    igst_amount: float = 0.0
    
    sort_order: int = 0

class BillPurchase(BaseModel):
    """
    Main Bill Purchase record created after photo approval.
    Contains complete purchase details and financial information.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Section 1: Bill Details
    bill_date: str  # ISO date string
    bill_number: str  # STC-BP-CY-XXXX format
    bill_type: str  # "entry" or "purchase"
    vehicle_number: str  # Auto-filled from weighbridge
    
    # Reference to pre-entry
    pre_entry_id: str
    pre_entry_number: str  # BPRE-YY-######
    weighbridge_slip_id: str  # Links to weighbridge_entries
    
    # Section 2: Supplier Details (auto-filled from pre-entry)
    supplier_id: str
    supplier_name: str
    supplier_gstin: Optional[str] = None
    place_of_supply: str
    
    # Broker details (auto-filled from pre-entry)
    has_broker: bool = False
    broker_name: Optional[str] = None
    brokerage_type: Optional[BrokerageType] = None
    brokerage_rate: Optional[float] = None
    brokerage_amount: float = 0.0
    
    # Section 3: Line Items (typically single item from weighbridge)
    line_items: List[BillPurchaseLineItem] = Field(default_factory=list)
    
    # Section 4: Adjustments
    batav_percentage: float = 0.0  # Cash discount %
    batav_amount: float = 0.0  # Calculated discount amount
    
    claim_type: str = "flat"  # "flat" or "percentage"
    claim_rate: float = 0.0  # Rate (flat amount or %)
    claim_amount: float = 0.0  # Final claim deduction amount
    
    # Totals
    line_items_total: float = 0.0  # Sum of line item amounts
    total_tax_amount: float = 0.0  # Sum of all taxes from line items
    gross_amount: float = 0.0  # line_items_total + total_tax_amount
    total_deductions: float = 0.0  # batav_amount + claim_amount
    net_amount: float = 0.0  # gross_amount - total_deductions
    
    # Document details
    eway_bill_no: Optional[str] = None
    remarks: Optional[str] = None
    
    # Status
    status: str = "draft"  # draft, posted, cancelled
    posted_at: Optional[datetime] = None
    posted_by: Optional[str] = None
    
    # Metadata
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class BillPurchaseCreate(BaseModel):
    pre_entry_id: str
    supplier_invoice_no: Optional[str] = None
    supplier_invoice_date: Optional[str] = None
    line_items: List[BillPurchaseLineItem] = Field(default_factory=list)
    freight: float = 0.0
    hamali_tulai: float = 0.0
    aadat: float = 0.0
    mandi_cess: float = 0.0
    bank_charges: float = 0.0
    rounding: float = 0.0
    remarks: Optional[str] = None
    created_by: str

# ============= QUEUE MODELS =============

class BillPurchaseQueueItem(BaseModel):
    """Bill Purchase queue item for pending pre-entries"""
    pre_entry_id: str
    pre_entry_number: str
    slip_id: str
    date: str
    supplier_name: str
    supplier_gstin: Optional[str] = None
    place_of_supply: str
    eway_bill_no: Optional[str] = None
    expected_quantity: Optional[str] = None  # Formatted display
    weighbridge_completed: bool = False
    status: str
    created_at: datetime
    weighed_at: Optional[datetime] = None

# ============= HELPER FUNCTIONS =============

def get_financial_year() -> int:
    """Get current financial year (Apr-Mar) for pre-entry numbering"""
    now = datetime.now(timezone.utc)
    if now.month >= 4:
        return now.year % 100
    else:
        return (now.year - 1) % 100

def calculate_brokerage_amount(brokerage_type: BrokerageType, brokerage_rate: float, 
                             total_bags: int, total_qtls: float, subtotal: float) -> float:
    """Calculate brokerage amount based on type and rate"""
    if not brokerage_rate or brokerage_type == BrokerageType.NONE:
        return 0.0
    
    if brokerage_type == BrokerageType.PER_BAG:
        return round(brokerage_rate * total_bags, 2)
    elif brokerage_type == BrokerageType.PER_QUINTAL:
        return round(brokerage_rate * total_qtls, 2)
    elif brokerage_type == BrokerageType.PERCENTAGE:
        return round((brokerage_rate / 100) * subtotal, 2)
    else:
        return 0.0

def calculate_bill_totals(line_items: List[BillPurchaseLineItem], 
                         freight: float, hamali_tulai: float, aadat: float,
                         mandi_cess: float, bank_charges: float, rounding: float,
                         brokerage_amount: float = 0.0) -> dict:
    """Calculate bill totals"""
    subtotal = sum(item.amount for item in line_items)
    total_charges = freight + hamali_tulai + aadat + mandi_cess + bank_charges + brokerage_amount
    grand_total = subtotal + total_charges + rounding
    
    return {
        "subtotal": round(subtotal, 2),
        "total_charges": round(total_charges, 2),
        "grand_total": round(grand_total, 2)
    }