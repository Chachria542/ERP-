"""
Farmer Payment Module - Database Models
Complete implementation with weighbridge integration and voucher generation
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid

# ============= WEIGHBRIDGE PRE-ENTRY MODELS =============

class WeighbridgePreEntry(BaseModel):
    """Weighbridge pre-entry with photos for approval"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slip_number: str  # WB######
    gate_entry_no: str  # Same as slip_number or different
    
    # Farmer details
    farmer_name: str
    mobile: str
    city: Optional[str] = None
    token_no: Optional[str] = None
    
    # Vehicle & Item
    vehicle_number: str
    vehicle_type: str  # Truck, Tractor, Hammali
    item_id: str
    item_name: str
    
    # Weights
    gross_weight: float  # kg
    tare_weight: float  # kg
    net_weight: float  # kg (auto-calculated)
    
    # Bags calculation
    bags: int  # net_weight // 100
    rem_kg: int  # net_weight % 100
    act_qtl: float  # net_weight / 100 (quintals)
    
    # Photos (Mock URLs for now)
    photo_gross_url: str
    photo_gross_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    photo_tare_url: str
    photo_tare_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Status
    status: str = "pending"  # pending, approved, rejected, settled
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WeighbridgePreEntryCreate(BaseModel):
    gate_entry_no: str
    farmer_name: str
    mobile: str
    city: Optional[str] = None
    token_no: Optional[str] = None
    vehicle_number: str
    vehicle_type: str
    item_id: str
    gross_weight: float
    tare_weight: float

# ============= FARMER PAYMENT MODELS =============

class FarmerPaymentLine(BaseModel):
    """Individual line item in farmer payment"""
    item_id: str
    item_name: str
    pack_kg: int = 100  # Fixed at 100 kg
    bags: int
    rem_kg: int  # Remaining kg (0-99)
    act_kg: float  # Actual weight in kg
    act_qtl: float  # Actual weight in quintals
    rate_per_qtl: float  # Rate per quintal
    item_amount: float  # act_qtl × rate_per_qtl
    vehicle_type: str  # Truck, Tractor, Hammali
    h_plus_t: float  # Auto-calculated based on vehicle type
    line_total: float  # item_amount - h_plus_t
    sort_order: int = 0

class FarmerPayment(BaseModel):
    """Main farmer payment record"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Header fields
    location: str  # Sanawad
    contract_type: str  # Anubandh or Sauda
    mandi_godown: str  # Mandi, Godown, Entry
    book_no: str  # SAN-YY-######
    bilty_no: Optional[str] = None
    date: str  # ISO date string
    tulai_no: Optional[str] = None
    agr_no: Optional[str] = None
    id_no: Optional[str] = None
    gate_entry_no: Optional[str] = None
    aadhaar: Optional[str] = None
    token_no: Optional[str] = None
    
    # Farmer details
    farmer_name: str
    mobile: str
    village: Optional[str] = None  # Changed from city to village
    vehicle_number: Optional[str] = None  # Fetched from weighbridge entry for print
    weighbridge_slip_no: Optional[str] = None  # Weight slip reference (वजन पर्ची)
    
    # Line items
    lines: List[FarmerPaymentLine]
    
    # Payment details
    pay_type: str  # Cash, Cheque, RTGS, aadat, Farmer, NEFT
    cash_bank_ac_id: Optional[str] = None
    account_no: Optional[str] = None
    cash_amt: float = 0.0
    bank_amt: float = 0.0
    additional_hamli: float = 0.0
    bank_charges: float = 0.0
    total_amount: float  # Sum(line_total) - additional_hamli - bank_charges
    
    # Voucher references
    purchase_voucher_id: Optional[str] = None
    payment_voucher_id: Optional[str] = None
    
    # Metadata
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class FarmerPaymentCreate(BaseModel):
    location: str
    contract_type: str
    mandi_godown: str
    bilty_no: Optional[str] = None
    date: str
    tulai_no: Optional[str] = None
    agr_no: Optional[str] = None
    id_no: Optional[str] = None
    gate_entry_no: Optional[str] = None
    aadhaar: Optional[str] = None
    token_no: Optional[str] = None
    
    farmer_name: str
    mobile: str
    village: Optional[str] = None  # Changed from city to village
    vehicle_number: Optional[str] = None
    
    lines: List[FarmerPaymentLine]
    
    pay_type: str
    cash_bank_ac_id: Optional[str] = None
    account_no: Optional[str] = None
    cash_amt: float = 0.0
    bank_amt: float = 0.0
    additional_hamli: float = 0.0
    bank_charges: float = 0.0
    
    created_by: str

# ============= VOUCHER MODELS =============

class PurchaseVoucher(BaseModel):
    """Purchase voucher generated from farmer payment"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voucher_no: str
    voucher_type: str = "purchase"
    farmer_payment_id: str
    book_no: str
    farmer_id: str
    farmer_name: str
    total_amount: float
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class PaymentVoucher(BaseModel):
    """Payment voucher for farmer settlement"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voucher_no: str
    voucher_type: str = "payment"
    farmer_payment_id: str
    book_no: str
    farmer_id: str
    farmer_name: str
    pay_type: str
    cash_amt: float
    bank_amt: float
    total_paid: float
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

# ============= HELPER FUNCTIONS =============

def calculate_h_plus_t(vehicle_type: str, act_qtl: float) -> float:
    """Calculate H+T based on vehicle type"""
    rates = {
        "Truck": 4.75,
        "Hammali": 5.75,
        "Tractor": 0.0
    }
    rate = rates.get(vehicle_type, 0.0)
    return round(rate * act_qtl, 2)

def calculate_line_total(item_amount: float, h_plus_t: float) -> float:
    """Calculate line total"""
    return round(item_amount - h_plus_t, 2)

def convert_kg_to_bags_and_qtl(net_kg: float) -> dict:
    """Convert kg to bags, remaining kg, and quintals"""
    bags = int(net_kg // 100)
    rem_kg = int(net_kg % 100)
    act_qtl = round(net_kg / 100, 2)
    return {
        "bags": bags,
        "rem_kg": rem_kg,
        "act_qtl": act_qtl
    }
