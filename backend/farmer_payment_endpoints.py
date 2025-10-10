"""
Farmer Payment Module - API Endpoints
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from farmer_payment_models import (
    WeighbridgePreEntry, WeighbridgePreEntryCreate,
    FarmerPayment, FarmerPaymentCreate, FarmerPaymentLine,
    PurchaseVoucher, PaymentVoucher,
    calculate_h_plus_t, calculate_line_total, convert_kg_to_bags_and_qtl
)
from typing import List
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
db = None

def init_db(database):
    global db
    db = database

# ============= HELPER FUNCTIONS =============

async def generate_book_number(location: str, fy_year: int) -> str:
    """Generate book number: SAN-YY-######"""
    # Get the last book number for this FY
    last_payment = await db.farmer_payments.find_one(
        {"book_no": {"$regex": f"^{location[:3].upper()}-{fy_year:02d}-"}},
        sort=[("book_no", -1)]
    )
    
    if last_payment:
        # Extract sequence number and increment
        last_no = int(last_payment['book_no'].split('-')[-1])
        new_no = last_no + 1
    else:
        new_no = 1
    
    return f"{location[:3].upper()}-{fy_year:02d}-{new_no:06d}"

def get_financial_year() -> int:
    """Get current financial year (Apr-Mar)"""
    now = datetime.now(timezone.utc)
    if now.month >= 4:
        return now.year % 100
    else:
        return (now.year - 1) % 100

async def create_purchase_voucher(farmer_payment: FarmerPayment) -> PurchaseVoucher:
    """Create purchase voucher"""
    voucher_no = f"PV-{farmer_payment.book_no}"
    
    voucher = PurchaseVoucher(
        voucher_no=voucher_no,
        farmer_payment_id=farmer_payment.id,
        book_no=farmer_payment.book_no,
        farmer_id=farmer_payment.id,  # Using payment ID as farmer reference
        farmer_name=farmer_payment.farmer_name,
        total_amount=farmer_payment.total_amount,
        description=f"Purchase from {farmer_payment.farmer_name} - {farmer_payment.book_no}",
        created_by=farmer_payment.created_by
    )
    
    # Save to database
    doc = voucher.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.purchase_vouchers.insert_one(doc)
    
    # Create ledger entries
    await db.ledger_entries.insert_one({
        "id": str(uuid.uuid4()),
        "entry_type": "purchase",
        "reference_type": "farmer_payment",
        "reference_id": farmer_payment.id,
        "party_id": farmer_payment.id,
        "party_name": farmer_payment.farmer_name,
        "description": f"Purchase - {voucher_no}",
        "debit_amount": farmer_payment.total_amount,
        "credit_amount": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": farmer_payment.created_by
    })
    
    return voucher

async def create_payment_voucher(farmer_payment: FarmerPayment) -> PaymentVoucher:
    """Create payment voucher"""
    voucher_no = f"PAY-{farmer_payment.book_no}"
    
    voucher = PaymentVoucher(
        voucher_no=voucher_no,
        farmer_payment_id=farmer_payment.id,
        book_no=farmer_payment.book_no,
        farmer_id=farmer_payment.id,
        farmer_name=farmer_payment.farmer_name,
        pay_type=farmer_payment.pay_type,
        cash_amt=farmer_payment.cash_amt,
        bank_amt=farmer_payment.bank_amt,
        total_paid=farmer_payment.cash_amt + farmer_payment.bank_amt,
        description=f"Payment to {farmer_payment.farmer_name} - {farmer_payment.pay_type}",
        created_by=farmer_payment.created_by
    )
    
    # Save to database
    doc = voucher.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.payment_vouchers.insert_one(doc)
    
    # Create ledger entry for payment
    await db.ledger_entries.insert_one({
        "id": str(uuid.uuid4()),
        "entry_type": "payment",
        "reference_type": "farmer_payment",
        "reference_id": farmer_payment.id,
        "party_id": farmer_payment.id,
        "party_name": farmer_payment.farmer_name,
        "description": f"Payment - {voucher_no} - {farmer_payment.pay_type}",
        "debit_amount": 0.0,
        "credit_amount": farmer_payment.cash_amt + farmer_payment.bank_amt,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": farmer_payment.created_by
    })
    
    return voucher

# ============= WEIGHBRIDGE ENDPOINTS =============

@router.post("/weighbridge/pre-entry", response_model=WeighbridgePreEntry)
async def create_weighbridge_pre_entry(entry_data: WeighbridgePreEntryCreate):
    """Create weighbridge pre-entry with mock photos"""
    # Calculate net weight
    net_weight = entry_data.gross_weight - entry_data.tare_weight
    
    # Calculate bags and quintals
    conversion = convert_kg_to_bags_and_qtl(net_weight)
    
    # Get item details
    item = await db.items.find_one({"id": entry_data.item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Generate slip number
    count = await db.weighbridge_pre_entries.count_documents({})
    slip_number = f"WB{count + 1:06d}"
    
    # Mock photo URLs (sample images)
    mock_photos = [
        "https://via.placeholder.com/800x600.png?text=Gross+Weight+Photo",
        "https://via.placeholder.com/800x600.png?text=Tare+Weight+Photo"
    ]
    
    entry = WeighbridgePreEntry(
        slip_number=slip_number,
        gate_entry_no=entry_data.gate_entry_no,
        farmer_name=entry_data.farmer_name,
        mobile=entry_data.mobile,
        city=entry_data.city,
        token_no=entry_data.token_no,
        vehicle_number=entry_data.vehicle_number,
        vehicle_type=entry_data.vehicle_type,
        item_id=entry_data.item_id,
        item_name=item['name'],
        gross_weight=entry_data.gross_weight,
        tare_weight=entry_data.tare_weight,
        net_weight=net_weight,
        bags=conversion['bags'],
        rem_kg=conversion['rem_kg'],
        act_qtl=conversion['act_qtl'],
        photo_gross_url=mock_photos[0],
        photo_tare_url=mock_photos[1]
    )
    
    doc = entry.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['photo_gross_timestamp'] = doc['photo_gross_timestamp'].isoformat()
    doc['photo_tare_timestamp'] = doc['photo_tare_timestamp'].isoformat()
    await db.weighbridge_pre_entries.insert_one(doc)
    
    return entry

@router.get("/weighbridge/slip/{gate_entry_no}")
async def get_weighbridge_slip(gate_entry_no: str):
    """Fetch weighbridge slip by gate entry number"""
    logger.info(f"Looking for gate_entry_no: {gate_entry_no}")
    logger.info(f"DB object is None: {db is None}")
    
    # Check if collection exists and has data
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    count = await db.weighbridge_pre_entries.count_documents({})
    logger.info(f"Total documents in weighbridge_pre_entries: {count}")
    
    entry = await db.weighbridge_pre_entries.find_one(
        {"gate_entry_no": gate_entry_no},
        {"_id": 0}
    )
    
    logger.info(f"Entry found: {entry is not None}")
    
    if not entry:
        raise HTTPException(status_code=404, detail="Weighbridge slip not found")
    
    if entry['status'] == 'settled':
        raise HTTPException(status_code=400, detail="Slip already settled")
    
    # Convert datetime strings back
    if isinstance(entry.get('created_at'), str):
        entry['created_at'] = datetime.fromisoformat(entry['created_at'])
    if isinstance(entry.get('photo_gross_timestamp'), str):
        entry['photo_gross_timestamp'] = datetime.fromisoformat(entry['photo_gross_timestamp'])
    if isinstance(entry.get('photo_tare_timestamp'), str):
        entry['photo_tare_timestamp'] = datetime.fromisoformat(entry['photo_tare_timestamp'])
    
    return entry

@router.put("/weighbridge/approve/{gate_entry_no}")
async def approve_weighbridge_slip(gate_entry_no: str, user_id: str):
    """Approve weighbridge slip"""
    result = await db.weighbridge_pre_entries.update_one(
        {"gate_entry_no": gate_entry_no},
        {"$set": {
            "status": "approved",
            "approved_by": user_id,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Slip not found")
    
    return {"message": "Slip approved successfully"}

# ============= FARMER PAYMENT ENDPOINTS =============

@router.post("/farmer-payment", response_model=FarmerPayment)
async def create_farmer_payment(payment_data: FarmerPaymentCreate):
    """Create farmer payment with voucher generation"""
    import uuid
    
    try:
        # Generate book number
        fy_year = get_financial_year()
        book_no = await generate_book_number(payment_data.location, fy_year)
        
        # Calculate totals
        line_total_sum = sum(line.line_total for line in payment_data.lines)
        total_amount = line_total_sum - payment_data.additional_hamli - payment_data.bank_charges
        
        # Create farmer payment
        farmer_payment = FarmerPayment(
            book_no=book_no,
            total_amount=total_amount,
            **payment_data.model_dump()
        )
        
        # Save to database
        doc = farmer_payment.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.farmer_payments.insert_one(doc)
        
        # Create vouchers
        purchase_voucher = await create_purchase_voucher(farmer_payment)
        payment_voucher = await create_payment_voucher(farmer_payment)
        
        # Update payment with voucher IDs
        await db.farmer_payments.update_one(
            {"id": farmer_payment.id},
            {"$set": {
                "purchase_voucher_id": purchase_voucher.id,
                "payment_voucher_id": payment_voucher.id
            }}
        )
        
        # Mark weighbridge slip as settled if gate_entry_no provided
        if payment_data.gate_entry_no:
            await db.weighbridge_pre_entries.update_one(
                {"gate_entry_no": payment_data.gate_entry_no},
                {"$set": {"status": "settled"}}
            )
        
        farmer_payment.purchase_voucher_id = purchase_voucher.id
        farmer_payment.payment_voucher_id = payment_voucher.id
        
        return farmer_payment
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/farmer-payments", response_model=List[FarmerPayment])
async def get_farmer_payments():
    """Get all farmer payments"""
    payments = await db.farmer_payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for payment in payments:
        if isinstance(payment.get('created_at'), str):
            payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    
    return payments

@router.get("/farmer-payment/{payment_id}", response_model=FarmerPayment)
async def get_farmer_payment(payment_id: str):
    """Get farmer payment by ID"""
    payment = await db.farmer_payments.find_one({"id": payment_id}, {"_id": 0})
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if isinstance(payment.get('created_at'), str):
        payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    
    return payment

@router.get("/book-number-next")
async def get_next_book_number(location: str):
    """Get next book number"""
    fy_year = get_financial_year()
    book_no = await generate_book_number(location, fy_year)
    return {"book_no": book_no, "fy_year": fy_year}
