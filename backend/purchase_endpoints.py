"""
Purchase Module Endpoints
Handles Farmer Payment and Bill Purchase operations
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from purchase_models import (
    FarmerPayment, FarmerPaymentCreate,
    BillPurchase, BillPurchaseCreate,
    PaymentVoucher, LedgerEntryAuto
)

router = APIRouter()

# Database will be injected from main server
db = None

def init_db(database):
    """Initialize database connection"""
    global db
    db = database

# ============= HELPER FUNCTIONS =============

async def generate_voucher_number(prefix: str) -> str:
    """Generate voucher number: PREFIX/YYYY/NNNN"""
    year = datetime.now(timezone.utc).year
    # Count existing vouchers for this year
    count = await db.payment_vouchers.count_documents({
        "voucher_number": {"$regex": f"^{prefix}/{year}/"}
    })
    return f"{prefix}/{year}/{count + 1:04d}"

async def generate_bill_purchase_number() -> str:
    """Generate bill purchase number: BP/YYYY/NNNN"""
    year = datetime.now(timezone.utc).year
    count = await db.bill_purchases.count_documents({
        "bill_purchase_no": {"$regex": f"^BP/{year}/"}
    })
    return f"BP/{year}/{count + 1:04d}"

async def get_weighbridge_slip_data(tulai_no: str):
    """Get weighbridge slip details for auto-population"""
    slip = await db.weighbridge_slips.find_one({"slip_number": tulai_no}, {"_id": 0})
    return slip

# ============= FARMER PAYMENT ENDPOINTS =============

@router.post("/farmer-payment", response_model=FarmerPayment)
async def create_farmer_payment(payment_data: FarmerPaymentCreate):
    """
    Create farmer payment with auto-voucher and ledger generation
    Calculation: Total = Sum(Item Amt - H+T) - Additional Hammali + Bank Charges
    """
    try:
        # Calculate totals
        items_total = sum(item.total for item in payment_data.items)
        total_amount = items_total - payment_data.additional_hammali + payment_data.bank_charges
        
        # Generate voucher number
        voucher_number = await generate_voucher_number("FPV")
        
        # Create farmer payment
        farmer_payment = FarmerPayment(
            voucher_number=voucher_number,
            **payment_data.model_dump(),
            total_amount=total_amount
        )
        
        # Save to database
        doc = farmer_payment.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['date'] = payment_data.date  # Keep as string
        await db.farmer_payments.insert_one(doc)
        
        # Generate payment voucher
        voucher = PaymentVoucher(
            voucher_number=voucher_number,
            voucher_type="farmer_payment",
            reference_id=farmer_payment.id,
            party_id=payment_data.farmer_id,
            party_name=payment_data.farmer_name,
            amount=total_amount,
            payment_mode=payment_data.payment_type,
            created_by=payment_data.created_by
        )
        voucher_doc = voucher.model_dump()
        voucher_doc['created_at'] = voucher_doc['created_at'].isoformat()
        await db.payment_vouchers.insert_one(voucher_doc)
        
        # Create ledger entry (Debit: Purchase, Credit: Cash/Bank)
        ledger = LedgerEntryAuto(
            entry_type="farmer_payment",
            reference_type="farmer_payment",
            reference_id=farmer_payment.id,
            party_id=payment_data.farmer_id,
            party_name=payment_data.farmer_name,
            description=f"Farmer Payment - {voucher_number}",
            debit_amount=total_amount,  # Purchase debit
            credit_amount=0,
            created_by=payment_data.created_by
        )
        ledger_doc = ledger.model_dump()
        ledger_doc['created_at'] = ledger_doc['created_at'].isoformat()
        await db.ledger_entries.insert_one(ledger_doc)
        
        # Create corresponding credit entry for payment account
        ledger_credit = LedgerEntryAuto(
            entry_type="farmer_payment",
            reference_type="farmer_payment",
            reference_id=farmer_payment.id,
            party_id=payment_data.farmer_id,
            party_name=payment_data.cash_bank_account,
            description=f"Payment for {voucher_number} - {payment_data.payment_type}",
            debit_amount=0,
            credit_amount=total_amount,  # Cash/Bank credit
            created_by=payment_data.created_by
        )
        ledger_credit_doc = ledger_credit.model_dump()
        ledger_credit_doc['created_at'] = ledger_credit_doc['created_at'].isoformat()
        await db.ledger_entries.insert_one(ledger_credit_doc)
        
        return farmer_payment
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/farmer-payment/{payment_id}", response_model=FarmerPayment)
async def get_farmer_payment(payment_id: str):
    """Get farmer payment by ID"""
    payment = await db.farmer_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Farmer payment not found")
    
    if isinstance(payment.get('created_at'), str):
        payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    
    return payment

@router.get("/farmer-payments")
async def get_farmer_payments():
    """Get all farmer payments"""
    payments = await db.farmer_payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for payment in payments:
        if isinstance(payment.get('created_at'), str):
            payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    
    return payments

@router.get("/weighbridge-slip/{tulai_no}")
async def get_weighbridge_slip_for_autofill(tulai_no: str):
    """Get weighbridge slip data for auto-population in farmer payment"""
    slip = await get_weighbridge_slip_data(tulai_no)
    if not slip:
        raise HTTPException(status_code=404, detail="Weighbridge slip not found")
    return slip

# ============= BILL PURCHASE ENDPOINTS =============

@router.post("/bill-purchase", response_model=BillPurchase)
async def create_bill_purchase(purchase_data: BillPurchaseCreate):
    """
    Create bill purchase with GST calculations
    Net Amount = Sum(Item Totals) - Batav - Shortage + Claim - Pending
    """
    try:
        # Calculate totals
        items_total = sum(item.item_total for item in purchase_data.items)
        net_amount = (items_total - purchase_data.batav_amt - purchase_data.shortage_amt + 
                     purchase_data.claim - purchase_data.pending)
        
        # Generate bill purchase number
        bill_purchase_no = await generate_bill_purchase_number()
        
        # Get supplier name
        supplier = await db.parties.find_one({"id": purchase_data.supplier_id})
        supplier_name = supplier['name'] if supplier else "Unknown Supplier"
        
        # Get broker name if provided
        broker_name = None
        if purchase_data.broker_id:
            broker = await db.parties.find_one({"id": purchase_data.broker_id})
            broker_name = broker['name'] if broker else None
        
        # Create bill purchase
        bill_purchase = BillPurchase(
            bill_purchase_no=bill_purchase_no,
            supplier_name=supplier_name,
            broker_name=broker_name,
            **purchase_data.model_dump(),
            net_amount=net_amount
        )
        
        # Save to database
        doc = bill_purchase.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.bill_purchases.insert_one(doc)
        
        # Create ledger entry (Debit: Purchase, Credit: Supplier)
        ledger = LedgerEntryAuto(
            entry_type="bill_purchase",
            reference_type="bill_purchase",
            reference_id=bill_purchase.id,
            party_id=purchase_data.supplier_id,
            party_name=supplier_name,
            description=f"Bill Purchase - {bill_purchase_no} - Bill No: {purchase_data.bill_no}",
            debit_amount=net_amount,  # Purchase debit
            credit_amount=0,
            created_by=purchase_data.created_by
        )
        ledger_doc = ledger.model_dump()
        ledger_doc['created_at'] = ledger_doc['created_at'].isoformat()
        await db.ledger_entries.insert_one(ledger_doc)
        
        # Create corresponding credit entry for supplier account
        ledger_credit = LedgerEntryAuto(
            entry_type="bill_purchase",
            reference_type="bill_purchase",
            reference_id=bill_purchase.id,
            party_id=purchase_data.supplier_id,
            party_name=supplier_name,
            description=f"Supplier Credit - {bill_purchase_no}",
            debit_amount=0,
            credit_amount=net_amount,  # Supplier credit
            created_by=purchase_data.created_by
        )
        ledger_credit_doc = ledger_credit.model_dump()
        ledger_credit_doc['created_at'] = ledger_credit_doc['created_at'].isoformat()
        await db.ledger_entries.insert_one(ledger_credit_doc)
        
        return bill_purchase
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/bill-purchase/{purchase_id}", response_model=BillPurchase)
async def get_bill_purchase(purchase_id: str):
    """Get bill purchase by ID"""
    purchase = await db.bill_purchases.find_one({"id": purchase_id}, {"_id": 0})
    if not purchase:
        raise HTTPException(status_code=404, detail="Bill purchase not found")
    
    if isinstance(purchase.get('created_at'), str):
        purchase['created_at'] = datetime.fromisoformat(purchase['created_at'])
    
    return purchase

@router.get("/bill-purchases")
async def get_bill_purchases():
    """Get all bill purchases"""
    purchases = await db.bill_purchases.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for purchase in purchases:
        if isinstance(purchase.get('created_at'), str):
            purchase['created_at'] = datetime.fromisoformat(purchase['created_at'])
    
    return purchases

# ============= VOUCHER ENDPOINTS =============

@router.get("/payment-voucher/{voucher_number}")
async def get_payment_voucher(voucher_number: str):
    """Get payment voucher details"""
    voucher = await db.payment_vouchers.find_one({"voucher_number": voucher_number}, {"_id": 0})
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    if isinstance(voucher.get('created_at'), str):
        voucher['created_at'] = datetime.fromisoformat(voucher['created_at'])
    
    return voucher

@router.get("/payment-vouchers")
async def get_payment_vouchers():
    """Get all payment vouchers"""
    vouchers = await db.payment_vouchers.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for voucher in vouchers:
        if isinstance(voucher.get('created_at'), str):
            voucher['created_at'] = datetime.fromisoformat(voucher['created_at'])
    
    return vouchers
