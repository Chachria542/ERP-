"""
Sales Module - Database Models
Handles Sales Pre-Entry, Sales Invoice, and Sales Return
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid

# ============= ENUMS =============

class SalesStatus(str, Enum):
    """Sales status workflow"""
    WEIGH_PENDING = "weigh_pending"
    PENDING = "pending"
    INVOICE_GENERATED = "invoice_generated"
    CANCELLED = "cancelled"

class SaleType(str, Enum):
    """Sale or Return"""
    NORMAL_SALE = "normal_sale"
    SALES_RETURN = "sales_return"

class BrokerageType(str, Enum):
    PER_QUINTAL = "per_quintal"
    PER_BAG = "per_bag"
    PERCENTAGE = "percentage"
    NONE = "none"

# ============= SALES PRE-ENTRY MODELS =============

class SalesPreEntry(BaseModel):
    """
    Sales Pre-Entry created after order confirmation, before loading.
    Generates QR slip for driver to take to weighbridge for tare weight.
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pre_entry_number: str  # SPRE-YY-######
    slip_id: str  # Same as pre_entry_number, used for weighbridge integration
    qr_code: str  # QR code data for scanning
    
    # Basic details
    date: str  # ISO date string (auto-filled with today)
    order_number: Optional[str] = None  # For future order integration
    
    # Customer details
    customer_id: str  # FK to parties collection (role=customer)
    customer_name: str  # Auto-filled from customer
    customer_gstin: Optional[str] = None
    place_of_supply: str  # Required free text
    
    # Item details
    item_id: Optional[str] = None  # FK to items collection
    item_name: Optional[str] = None  # Auto-filled from item
    item_rate: Optional[float] = None  # Rate per quintal (can be from order)
    marka: Optional[str] = None  # Brand/Marka (free text + dropdown memory)
    
    # Pack size (Bharti)
    bharti: int = 50  # Pack size in kg (default 50 kg)
    
    # Expected weight
    expected_weight: Optional[float] = None  # Expected weight in quintals
    
    # Broker details (default checked)
    has_broker: bool = True
    broker_id: Optional[str] = None  # FK to brokers collection
    broker_name: Optional[str] = None
    brokerage_type: Optional[BrokerageType] = BrokerageType.PER_QUINTAL
    brokerage_rate: Optional[float] = None
    
    # Additional
    remarks: Optional[str] = None
    
    # Status and tracking
    status: SalesStatus = SalesStatus.WEIGH_PENDING
    weighbridge_completed: bool = False
    weighbridge_slip_id: Optional[str] = None  # Links to weighbridge_entries
    tare_weight: Optional[float] = None
    gross_weight: Optional[float] = None
    net_weight: Optional[float] = None
    
    # Metadata
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class SalesPreEntryCreate(BaseModel):
    """Request model for creating sales pre-entry"""
    date: str
    order_number: Optional[str] = None
    customer_id: str
    customer_gstin: Optional[str] = None
    place_of_supply: str
    item_id: Optional[str] = None
    item_rate: Optional[float] = None
    marka: Optional[str] = None
    bharti: int = 50
    expected_weight: Optional[float] = None
    has_broker: bool = True
    broker_id: Optional[str] = None
    broker_name: Optional[str] = None
    brokerage_type: Optional[BrokerageType] = BrokerageType.PER_QUINTAL
    brokerage_rate: Optional[float] = None
    remarks: Optional[str] = None
    created_by: str

# ============= SALES INVOICE MODELS =============

class SalesInvoiceLineItem(BaseModel):
    """Individual line item in sales invoice"""
    item_id: str
    item_name: str
    marka: Optional[str] = None
    
    # Quantity
    bags: int
    kgs: float = 0.0
    bharti: int = 50  # Pack size in kg
    actual_qtl: float  # (bags × bharti + kgs) / 100
    
    # Pricing
    rate: float  # Rate per quintal (exclusive of tax)
    amount: float  # actual_qtl × rate

class SalesInvoice(BaseModel):
    """
    Sales Invoice / Sales Return
    Same structure handles both normal sales and returns through sale_type toggle
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str  # SAL-YY-######
    
    # Header
    sale_type: SaleType = SaleType.NORMAL_SALE
    invoice_date: str  # ISO date string
    
    # Reference
    pre_entry_id: str  # FK to sales_pre_entries
    pre_entry_number: str
    weighbridge_slip_id: Optional[str] = None
    order_number: Optional[str] = None
    
    # Customer details
    customer_id: str
    customer_name: str
    customer_gstin: Optional[str] = None
    place_of_supply: str
    
    # Location
    is_entry: bool = False  # False = Godown (default), True = Entry
    location_name: Optional[str] = None
    
    # Broker details (always optional)
    broker_name: Optional[str] = None
    brokerage_type: Optional[str] = None
    brokerage_rate: Optional[float] = None
    
    # Line items
    line_items: List[SalesInvoiceLineItem] = Field(default_factory=list)
    
    # Taxes (CGST + SGST only)
    cgst_rate: Optional[float] = None
    cgst_amount: float = 0.0
    sgst_rate: Optional[float] = None
    sgst_amount: float = 0.0
    
    # Additional charges
    freight: Optional[float] = None
    loading_charges: Optional[float] = None
    other_charges: Optional[float] = None
    
    # TCS (applied before GST)
    tcs_applicable: bool = False
    tcs_rate: Optional[float] = None
    tcs_amount: float = 0.0
    
    # Totals
    subtotal: float = 0.0  # Sum of line amounts
    round_off: float = 0.0  # Round to nearest ₹1
    grand_total: float = 0.0  # Final amount after round-off
    
    # Transporter (for freight slip)
    transporter_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    route: Optional[str] = None
    
    # Additional
    remarks: Optional[str] = None
    
    # Status
    status: str = "draft"  # draft, posted
    posted_at: Optional[datetime] = None
    posted_by: Optional[str] = None
    
    # Metadata
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class SalesInvoiceCreate(BaseModel):
    """Request model for creating sales invoice"""
    sale_type: SaleType = SaleType.NORMAL_SALE
    invoice_date: str
    pre_entry_id: str
    weighbridge_slip_no: Optional[str] = None
    
    # Location
    is_entry: bool = False  # False = Godown (default), True = Entry
    
    # Line items (item, marka, bags, kgs, bharti, rate)
    line_items: List[dict]  # Will process in endpoint
    
    # Taxes (CGST + SGST only, no IGST)
    cgst_rate: Optional[float] = None
    cgst_amount: float = 0.0
    sgst_rate: Optional[float] = None
    sgst_amount: float = 0.0
    
    # Additional charges
    freight: Optional[float] = None
    loading_charges: Optional[float] = None
    other_charges: Optional[float] = None
    
    # TCS (applied before GST)
    tcs_applicable: bool = False
    tcs_rate: Optional[float] = None
    tcs_amount: float = 0.0
    
    # Totals
    round_off: float = 0.0
    grand_total: float = 0.0
    
    # Broker (always optional)
    broker_name: Optional[str] = None
    brokerage_type: Optional[str] = None
    brokerage_rate: Optional[float] = None
    
    # Additional
    remarks: Optional[str] = None
    created_by: str

# ============= MARKA MEMORY MODEL =============

class Marka(BaseModel):
    """Marka (brand) memory per item for dropdown"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str  # FK to items collection
    item_name: str
    marka: str  # Brand/Marka name
    last_used: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= QUEUE MODELS =============

class SalesQueueItem(BaseModel):
    """Sales queue item for pending pre-entries"""
    pre_entry_id: str
    pre_entry_number: str
    slip_id: str
    date: str
    customer_name: str
    item_name: Optional[str] = None
    marka: Optional[str] = None
    tare_weight: Optional[float] = None
    gross_weight: Optional[float] = None
    net_weight: Optional[float] = None
    broker_name: Optional[str] = None
    status: str
    weighbridge_completed: bool
    created_at: datetime
    weighed_at: Optional[datetime] = None
