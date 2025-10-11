"""
Bill Purchase Module - API Endpoints
Handles bill purchase pre-entries, weighbridge integration, and bill creation
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from bill_purchase_models import (
    BillPurchasePreEntry, BillPurchasePreEntryCreate,
    BillPurchase, BillPurchaseCreate,
    BillPurchaseQueueItem, BillPurchaseStatus,
    PartyExtended, PartyExtendedCreate, PartyExtendedUpdate,
    get_financial_year, calculate_brokerage_amount, calculate_bill_totals
)
from universal_weighbridge_models import generate_qr_code_data, TransactionType
from typing import List, Optional
import uuid

router = APIRouter()
db = None

def init_db(database):
    global db
    db = database

# ============= HELPER FUNCTIONS =============

async def generate_pre_entry_number() -> str:
    """Generate unique pre-entry number: BPRE-YY-######"""
    fy_year = get_financial_year()
    
    # Get last pre-entry for this FY
    last_entry = await db.bill_purchase_pre_entries.find_one(
        {"pre_entry_number": {"$regex": f"^BPRE-{fy_year:02d}-"}},
        sort=[("pre_entry_number", -1)]
    )
    
    if last_entry:
        last_no = int(last_entry['pre_entry_number'].split('-')[-1])
        new_no = last_no + 1
    else:
        new_no = 1
    
    return f"BPRE-{fy_year:02d}-{new_no:06d}"

async def check_duplicate_supplier_eway(supplier_id: str, eway_bill_no: str) -> bool:
    """Check for duplicate Supplier + E-Way Bill combination"""
    if not eway_bill_no:
        return False
    
    existing = await db.bill_purchase_pre_entries.find_one({
        "supplier_id": supplier_id,
        "eway_bill_no": eway_bill_no,
        "status": {"$ne": "cancelled"}
    })
    
    return existing is not None

# ============= PARTY MANAGEMENT ENDPOINTS =============

@router.get("/parties/suppliers", response_model=List[PartyExtended])
async def get_suppliers():
    """Get all parties with supplier role"""
    parties = await db.parties.find(
        {"roles": "supplier"}, 
        {"_id": 0}
    ).to_list(1000)
    
    for party in parties:
        if isinstance(party.get('created_at'), str):
            party['created_at'] = datetime.fromisoformat(party['created_at'])
        if isinstance(party.get('updated_at'), str):
            party['updated_at'] = datetime.fromisoformat(party['updated_at'])
    
    return parties

@router.post("/parties/extended", response_model=PartyExtended)
async def create_extended_party(party_data: PartyExtendedCreate):
    """Create new party with extended fields"""
    party = PartyExtended(**party_data.model_dump())
    doc = party.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('updated_at'):
        doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.parties.insert_one(doc)
    return party

@router.get("/parties/extended/{party_id}", response_model=PartyExtended)
async def get_extended_party(party_id: str):
    """Get party with extended fields"""
    party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    
    if isinstance(party.get('created_at'), str):
        party['created_at'] = datetime.fromisoformat(party['created_at'])
    if isinstance(party.get('updated_at'), str):
        party['updated_at'] = datetime.fromisoformat(party['updated_at'])
    
    return party

@router.put("/parties/extended/{party_id}", response_model=PartyExtended)
async def update_extended_party(party_id: str, update_data: PartyExtendedUpdate):
    """Update party with extended fields"""
    # Check if party exists
    existing = await db.parties.find_one({"id": party_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Party not found")
    
    # Prepare update data
    update_fields = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Update party
    await db.parties.update_one(
        {"id": party_id},
        {"$set": update_fields}
    )
    
    # Return updated party
    updated_party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    if isinstance(updated_party.get('created_at'), str):
        updated_party['created_at'] = datetime.fromisoformat(updated_party['created_at'])
    if isinstance(updated_party.get('updated_at'), str):
        updated_party['updated_at'] = datetime.fromisoformat(updated_party['updated_at'])
    
    return updated_party

# ============= BILL PURCHASE PRE-ENTRY ENDPOINTS =============

@router.post("/bill-purchase/pre-entry", response_model=BillPurchasePreEntry)
async def create_bill_purchase_pre_entry(pre_entry_data: BillPurchasePreEntryCreate):
    """Create bill purchase pre-entry"""
    try:
        # Get supplier details
        supplier = await db.parties.find_one({"id": pre_entry_data.supplier_id})
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        
        # Check duplicate supplier + e-way bill combination
        if pre_entry_data.eway_bill_no:
            is_duplicate = await check_duplicate_supplier_eway(
                pre_entry_data.supplier_id, 
                pre_entry_data.eway_bill_no
            )
            if is_duplicate:
                raise HTTPException(
                    status_code=400, 
                    detail="Duplicate Supplier + E-Way Bill combination"
                )
        
        # Generate pre-entry number
        pre_entry_number = await generate_pre_entry_number()
        
        # Generate QR code data
        qr_data = generate_qr_code_data(pre_entry_number, TransactionType.BILL_PURCHASE)
        
        # Create pre-entry
        pre_entry = BillPurchasePreEntry(
            pre_entry_number=pre_entry_number,
            slip_id=pre_entry_number,  # Same as pre_entry_number
            qr_code=qr_data,
            date=pre_entry_data.date,
            supplier_id=pre_entry_data.supplier_id,
            supplier_name=supplier['name'],
            supplier_gstin=pre_entry_data.supplier_gstin or supplier.get('gstin'),
            place_of_supply=pre_entry_data.place_of_supply,
            has_broker=pre_entry_data.has_broker,
            broker_name=pre_entry_data.broker_name,
            brokerage_type=pre_entry_data.brokerage_type,
            brokerage_rate=pre_entry_data.brokerage_rate,
            eway_bill_no=pre_entry_data.eway_bill_no,
            expected_quantity_bags=pre_entry_data.expected_quantity_bags,
            expected_quantity_kgs=pre_entry_data.expected_quantity_kgs,
            expected_quantity_qtls=pre_entry_data.expected_quantity_qtls,
            remarks=pre_entry_data.remarks,
            created_by=pre_entry_data.created_by
        )
        
        # Save to database
        doc = pre_entry.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        if doc.get('updated_at'):
            doc['updated_at'] = doc['updated_at'].isoformat()
        
        await db.bill_purchase_pre_entries.insert_one(doc)
        
        return pre_entry
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/bill-purchase/pre-entries", response_model=List[BillPurchasePreEntry])
async def get_bill_purchase_pre_entries(
    status: Optional[str] = None,
    limit: Optional[int] = 100
):
    """Get bill purchase pre-entries with optional filtering"""
    filter_query = {}
    if status:
        filter_query["status"] = status
    
    pre_entries = await db.bill_purchase_pre_entries.find(
        filter_query, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    for entry in pre_entries:
        if isinstance(entry.get('created_at'), str):
            entry['created_at'] = datetime.fromisoformat(entry['created_at'])
        if isinstance(entry.get('updated_at'), str):
            entry['updated_at'] = datetime.fromisoformat(entry['updated_at'])
    
    return pre_entries

@router.get("/bill-purchase/pre-entry/{pre_entry_id}", response_model=BillPurchasePreEntry)
async def get_bill_purchase_pre_entry(pre_entry_id: str):
    """Get specific bill purchase pre-entry"""
    pre_entry = await db.bill_purchase_pre_entries.find_one(
        {"id": pre_entry_id}, 
        {"_id": 0}
    )
    
    if not pre_entry:
        raise HTTPException(status_code=404, detail="Pre-entry not found")
    
    if isinstance(pre_entry.get('created_at'), str):
        pre_entry['created_at'] = datetime.fromisoformat(pre_entry['created_at'])
    if isinstance(pre_entry.get('updated_at'), str):
        pre_entry['updated_at'] = datetime.fromisoformat(pre_entry['updated_at'])
    
    return pre_entry

@router.get("/bill-purchase/pre-entry/by-number/{pre_entry_number}")
async def get_pre_entry_by_number(pre_entry_number: str):
    """Get pre-entry by pre-entry number for weighbridge integration"""
    pre_entry = await db.bill_purchase_pre_entries.find_one(
        {"pre_entry_number": pre_entry_number}, 
        {"_id": 0}
    )
    
    if not pre_entry:
        raise HTTPException(status_code=404, detail="Pre-entry not found")
    
    # Check if already has weighbridge entry
    weighbridge_entry = await db.weighbridge_entries.find_one(
        {"slip_id": pre_entry_number}
    )
    
    if weighbridge_entry:
        # Return combined data similar to weighbridge entry endpoint
        if isinstance(weighbridge_entry.get('created_at'), str):
            weighbridge_entry['created_at'] = datetime.fromisoformat(weighbridge_entry['created_at'])
        
        return {
            "pre_entry": pre_entry,
            "weighbridge_entry": weighbridge_entry,
            "combined_data": {
                "slip_id": pre_entry_number,
                "transaction_type": "bill_purchase",
                "supplier_name": pre_entry['supplier_name'],
                "supplier_gstin": pre_entry.get('supplier_gstin'),
                "place_of_supply": pre_entry['place_of_supply'],
                "eway_bill_no": pre_entry.get('eway_bill_no'),
                "vehicle_number": weighbridge_entry.get('vehicle_number'),
                "vehicle_type": weighbridge_entry.get('vehicle_type'),
                "gross_weight": weighbridge_entry.get('gross_weight'),
                "tare_weight": weighbridge_entry.get('tare_weight'),
                "net_weight": weighbridge_entry.get('net_weight'),
                "bags": weighbridge_entry.get('bags'),
                "act_qtl": weighbridge_entry.get('act_qtl'),
                "photo_gross_url": weighbridge_entry.get('photo_gross_url'),
                "photo_tare_url": weighbridge_entry.get('photo_tare_url'),
                "payment_status": weighbridge_entry.get('payment_status', 'pending'),
                "status": pre_entry['status'],
                "created_at": pre_entry['created_at'],
                "weighed_at": weighbridge_entry.get('created_at')
            }
        }
    else:
        return {
            "pre_entry": pre_entry,
            "weighbridge_entry": None,
            "message": "Weighbridge entry not completed yet"
        }

# ============= BILL PURCHASE QUEUE ENDPOINTS =============

@router.get("/bill-purchase/queue", response_model=List[BillPurchaseQueueItem])
async def get_bill_purchase_queue(
    status: Optional[str] = "pending",
    search: Optional[str] = None,
    date_filter: Optional[str] = None,
    limit: Optional[int] = 100
):
    """Get bill purchase queue with filtering and search"""
    # Base query - only show entries with weighbridge completed
    query = {
        "weighbridge_completed": True
    }
    
    # Status filter
    if status:
        query["status"] = status
    
    # Search filter (pre_entry_number, supplier_name, eway_bill_no)
    if search:
        query["$or"] = [
            {"pre_entry_number": {"$regex": search, "$options": "i"}},
            {"supplier_name": {"$regex": search, "$options": "i"}},
            {"eway_bill_no": {"$regex": search, "$options": "i"}}
        ]
    
    # Date filter
    if date_filter == "today":
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        query["date"] = today
    
    # Get pre-entries
    pre_entries = await db.bill_purchase_pre_entries.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Build queue items
    queue_items = []
    for entry in pre_entries:
        # Get weighbridge entry for weighed_at timestamp
        weighbridge_entry = await db.weighbridge_entries.find_one(
            {"slip_id": entry['pre_entry_number']}
        )
        
        # Format expected quantity
        expected_qty = None
        if entry.get('expected_quantity_bags'):
            expected_qty = f"{entry['expected_quantity_bags']} bags"
        elif entry.get('expected_quantity_qtls'):
            expected_qty = f"{entry['expected_quantity_qtls']} qtls"
        elif entry.get('expected_quantity_kgs'):
            expected_qty = f"{entry['expected_quantity_kgs']} kgs"
        
        queue_item = BillPurchaseQueueItem(
            pre_entry_id=entry['id'],
            pre_entry_number=entry['pre_entry_number'],
            slip_id=entry['slip_id'],
            date=entry['date'],
            supplier_name=entry['supplier_name'],
            supplier_gstin=entry.get('supplier_gstin'),
            place_of_supply=entry['place_of_supply'],
            eway_bill_no=entry.get('eway_bill_no'),
            expected_quantity=expected_qty,
            weighbridge_completed=entry['weighbridge_completed'],
            status=entry['status'],
            created_at=datetime.fromisoformat(entry['created_at']) if isinstance(entry['created_at'], str) else entry['created_at'],
            weighed_at=datetime.fromisoformat(weighbridge_entry['created_at']) if weighbridge_entry and isinstance(weighbridge_entry.get('created_at'), str) else weighbridge_entry.get('created_at') if weighbridge_entry else None
        )
        
        queue_items.append(queue_item)
    
    return queue_items

# ============= BILL PURCHASE ENDPOINTS =============

@router.post("/bill-purchase", response_model=BillPurchase)
async def create_bill_purchase(bill_data: BillPurchaseCreate):
    """Create bill purchase after photo approval"""
    try:
        # Get pre-entry
        pre_entry = await db.bill_purchase_pre_entries.find_one({"id": bill_data.pre_entry_id})
        if not pre_entry:
            raise HTTPException(status_code=404, detail="Pre-entry not found")
        
        # Check if pre-entry is in correct status
        if pre_entry['status'] != BillPurchaseStatus.PENDING:
            raise HTTPException(
                status_code=400, 
                detail=f"Pre-entry status must be 'pending', current status: {pre_entry['status']}"
            )
        
        # Get weighbridge entry
        weighbridge_entry = await db.weighbridge_entries.find_one(
            {"slip_id": pre_entry['slip_id']}
        )
        if not weighbridge_entry:
            raise HTTPException(status_code=404, detail="Weighbridge entry not found")
        
        # Calculate brokerage if applicable
        total_bags = sum(item.bags for item in bill_data.line_items)
        total_qtls = sum(item.kgs / 100 for item in bill_data.line_items)
        subtotal = sum(item.amount for item in bill_data.line_items)
        
        brokerage_amount = 0.0
        if pre_entry['has_broker'] and pre_entry.get('brokerage_rate'):
            brokerage_amount = calculate_brokerage_amount(
                pre_entry['brokerage_type'],
                pre_entry['brokerage_rate'],
                total_bags,
                total_qtls,
                subtotal
            )
        
        # Calculate totals
        totals = calculate_bill_totals(
            bill_data.line_items,
            bill_data.freight,
            bill_data.hamali_tulai,
            bill_data.aadat,
            bill_data.mandi_cess,
            bill_data.bank_charges,
            bill_data.rounding,
            brokerage_amount
        )
        
        # Create bill purchase
        bill_purchase = BillPurchase(
            pre_entry_id=bill_data.pre_entry_id,
            pre_entry_number=pre_entry['pre_entry_number'],
            weighbridge_slip_id=weighbridge_entry['slip_id'],
            supplier_invoice_no=bill_data.supplier_invoice_no,
            supplier_invoice_date=bill_data.supplier_invoice_date,
            supplier_id=pre_entry['supplier_id'],
            supplier_name=pre_entry['supplier_name'],
            supplier_gstin=pre_entry.get('supplier_gstin'),
            place_of_supply=pre_entry['place_of_supply'],
            has_broker=pre_entry['has_broker'],
            broker_name=pre_entry.get('broker_name'),
            brokerage_type=pre_entry.get('brokerage_type'),
            brokerage_rate=pre_entry.get('brokerage_rate'),
            brokerage_amount=brokerage_amount,
            line_items=bill_data.line_items,
            freight=bill_data.freight,
            hamali_tulai=bill_data.hamali_tulai,
            aadat=bill_data.aadat,
            mandi_cess=bill_data.mandi_cess,
            bank_charges=bill_data.bank_charges,
            rounding=bill_data.rounding,
            subtotal=totals['subtotal'],
            total_charges=totals['total_charges'],
            grand_total=totals['grand_total'],
            eway_bill_no=pre_entry.get('eway_bill_no'),
            remarks=bill_data.remarks,
            created_by=bill_data.created_by
        )
        
        # Save bill to database
        doc = bill_purchase.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        if doc.get('updated_at'):
            doc['updated_at'] = doc['updated_at'].isoformat()
        
        await db.bill_purchases.insert_one(doc)
        
        # Update pre-entry status to bill_generated
        await db.bill_purchase_pre_entries.update_one(
            {"id": bill_data.pre_entry_id},
            {"$set": {
                "status": BillPurchaseStatus.BILL_GENERATED,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return bill_purchase
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/bill-purchase/{bill_id}", response_model=BillPurchase)
async def get_bill_purchase(bill_id: str):
    """Get specific bill purchase"""
    bill = await db.bill_purchases.find_one({"id": bill_id}, {"_id": 0})
    
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    if isinstance(bill.get('created_at'), str):
        bill['created_at'] = datetime.fromisoformat(bill['created_at'])
    if isinstance(bill.get('updated_at'), str):
        bill['updated_at'] = datetime.fromisoformat(bill['updated_at'])
    if isinstance(bill.get('posted_at'), str):
        bill['posted_at'] = datetime.fromisoformat(bill['posted_at'])
    
    return bill

@router.post("/bill-purchase/{bill_id}/post")
async def post_bill_purchase(bill_id: str, user_id: str):
    """Post/finalize bill purchase"""
    bill = await db.bill_purchases.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    if bill['status'] != "draft":
        raise HTTPException(status_code=400, detail="Bill is already posted or cancelled")
    
    # Update bill status
    await db.bill_purchases.update_one(
        {"id": bill_id},
        {"$set": {
            "status": "posted",
            "posted_at": datetime.now(timezone.utc).isoformat(),
            "posted_by": user_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Bill posted successfully"}

# ============= WEIGHBRIDGE INTEGRATION ENDPOINTS =============

@router.put("/bill-purchase/pre-entry/{pre_entry_id}/weighbridge-completed")
async def mark_weighbridge_completed(pre_entry_id: str, weighbridge_slip_id: str):
    """Mark pre-entry as weighbridge completed"""
    # Check if pre-entry exists
    pre_entry = await db.bill_purchase_pre_entries.find_one({"id": pre_entry_id})
    if not pre_entry:
        raise HTTPException(status_code=404, detail="Pre-entry not found")
    
    # Update pre-entry
    await db.bill_purchase_pre_entries.update_one(
        {"id": pre_entry_id},
        {"$set": {
            "weighbridge_completed": True,
            "weighbridge_slip_id": weighbridge_slip_id,
            "status": BillPurchaseStatus.PENDING,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Pre-entry marked as weighbridge completed"}

@router.put("/bill-purchase/pre-entry/{pre_entry_id}/cancel")
async def cancel_pre_entry(pre_entry_id: str, reason: str, cancelled_by: str):
    """Cancel pre-entry with reason"""
    # Check if pre-entry exists
    pre_entry = await db.bill_purchase_pre_entries.find_one({"id": pre_entry_id})
    if not pre_entry:
        raise HTTPException(status_code=404, detail="Pre-entry not found")
    
    # Update pre-entry status
    await db.bill_purchase_pre_entries.update_one(
        {"id": pre_entry_id},
        {"$set": {
            "status": BillPurchaseStatus.CANCELLED,
            "cancellation_reason": reason,
            "cancelled_by": cancelled_by,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Pre-entry cancelled successfully"}