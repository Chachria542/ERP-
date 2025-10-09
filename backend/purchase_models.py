"""
Purchase Module Models
Handles both Farmer Payment and Bill Purchase flows
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid

# ============= FARMER PAYMENT MODELS =============

class FarmerPaymentItem(BaseModel):
    """Individual item in farmer payment"""
    item_id: str
    item_name: str
    pack: str
    bag: Optional[float] = 0
    kgs: Optional[float] = 0
    act_kgs: Optional[float] = 0
    rate: float
    item_amt: float  # Rate × Act. Kgs
    vehicle: str
    ht_charges: float = 0  # H+T charges
    total: float  # Item Amt - H+T

class FarmerPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voucher_number: str  # Auto-generated FPV/YYYY/NNNN
    
    # Header
    location: str
    anubandh_sauda: str
    mandi_godown: str
    book_no: str
    bilty_no: str
    date: str  # ISO date string
    tulai_no: Optional[str] = None  # Weighbridge slip number
    token_no: Optional[str] = None
    
    # Farmer Details
    farmer_id: str
    farmer_name: str
    farmer_name_hi: Optional[str] = None  # Hindi name
    city: Optional[str] = None
    city_hi: Optional[str] = None  # Hindi city
    agr_no: Optional[str] = None
    id_no: Optional[str] = None
    aadhaar_no: Optional[str] = None
    mobile_no: str
    
    # Items
    items: List[FarmerPaymentItem]
    
    # Payment Details
    payment_type: str  # cash or bank
    cash_bank_account: str
    account_no: Optional[str] = None
    cash_amount: float = 0
    bank_amount: float = 0
    additional_hammali: float = 0
    bank_charges: float = 0
    total_amount: float  # Sum(item totals) - hammali + bank_charges
    
    # Metadata
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "active"  # active, cancelled

class FarmerPaymentCreate(BaseModel):
    location: str
    anubandh_sauda: str
    mandi_godown: str
    book_no: str
    bilty_no: str
    date: str
    tulai_no: Optional[str] = None
    token_no: Optional[str] = None
    
    farmer_id: str
    farmer_name: str
    farmer_name_hi: Optional[str] = None
    city: Optional[str] = None
    city_hi: Optional[str] = None
    agr_no: Optional[str] = None
    id_no: Optional[str] = None
    aadhaar_no: Optional[str] = None
    mobile_no: str
    
    items: List[FarmerPaymentItem]
    
    payment_type: str
    cash_bank_account: str
    account_no: Optional[str] = None
    cash_amount: float = 0
    bank_amount: float = 0
    additional_hammali: float = 0
    bank_charges: float = 0
    
    created_by: str

# ============= BILL PURCHASE MODELS =============

class BillPurchaseItem(BaseModel):
    """Individual item in bill purchase"""
    item_id: str
    item_name: str
    marka: Optional[str] = None  # Brand/Grade
    bag: Optional[float] = 0
    kgs: Optional[float] = 0
    pack: Optional[float] = 0
    cal_wt: Optional[float] = 0  # Calculated weight
    act_wt: Optional[float] = 0  # Actual weight
    agr_wt: Optional[float] = 0  # Agreed weight
    rate: float
    amount: float  # Rate × Act. Wt.
    agr_amt: Optional[float] = 0  # Agreed amount
    bardan: float = 0  # Packaging charge
    cgst_percent: float = 0
    cgst_amt: float = 0
    sgst_percent: float = 0
    sgst_amt: float = 0
    item_total: float  # Amount + CGST + SGST + Bardan

class BillPurchase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bill_purchase_no: str  # Auto-generated BP/YYYY/NNNN
    
    # Header
    date: str  # ISO date string
    bill_no: str
    bill_date: str  # ISO date string
    purchase_type: str  # direct or godown
    mandi_godown: str
    
    # Supplier & Broker
    supplier_id: str
    supplier_name: str
    broker_id: Optional[str] = None
    broker_name: Optional[str] = None
    brokerage_type: Optional[str] = None  # per_bag, percentage, etc.
    brokerage_rate: float = 0
    
    # Transaction Details
    challan_no: Optional[str] = None
    declaration_no: Optional[str] = None
    declaration_date: Optional[str] = None
    vehicle: Optional[str] = None
    agr_no: Optional[str] = None
    agr_date: Optional[str] = None
    remark: Optional[str] = None
    
    # Items
    items: List[BillPurchaseItem]
    
    # Footer Calculations
    batav_percent: float = 0  # Discount percentage
    batav_amt: float = 0
    shortage_percent: float = 0
    shortage_amt: float = 0
    pending: float = 0
    claim: float = 0
    net_amount: float  # Sum(item totals) - batav - shortage + claim - pending
    
    # Metadata
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "active"  # active, cancelled

class BillPurchaseCreate(BaseModel):
    date: str
    bill_no: str
    bill_date: str
    purchase_type: str
    mandi_godown: str
    
    supplier_id: str
    broker_id: Optional[str] = None
    brokerage_type: Optional[str] = None
    brokerage_rate: float = 0
    
    challan_no: Optional[str] = None
    declaration_no: Optional[str] = None
    declaration_date: Optional[str] = None
    vehicle: Optional[str] = None
    agr_no: Optional[str] = None
    agr_date: Optional[str] = None
    remark: Optional[str] = None
    
    items: List[BillPurchaseItem]
    
    batav_percent: float = 0
    batav_amt: float = 0
    shortage_percent: float = 0
    shortage_amt: float = 0
    pending: float = 0
    claim: float = 0
    
    created_by: str

# ============= VOUCHER & LEDGER MODELS =============

class PaymentVoucher(BaseModel):
    """Payment voucher generated from farmer payment"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voucher_number: str
    voucher_type: str  # farmer_payment, bill_payment
    reference_id: str  # ID of farmer payment or bill purchase
    party_id: str
    party_name: str
    amount: float
    payment_mode: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class LedgerEntryAuto(BaseModel):
    """Auto-generated ledger entry"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entry_type: str  # farmer_payment, bill_purchase
    reference_type: str  # farmer_payment, bill_purchase
    reference_id: str
    party_id: str
    party_name: str
    description: str
    debit_amount: float
    credit_amount: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
