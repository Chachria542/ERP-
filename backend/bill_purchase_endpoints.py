"""
Bill Purchase Module - API Endpoints
Handles bill purchase pre-entries, weighbridge integration, and bill creation
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from bill_purchase_models import (
    BillPurchasePreEntry, BillPurchasePreEntryCreate,
    BillPurchase, BillPurchaseCreate, BillPurchaseLineItem,
    BillPurchaseQueueItem, BillPurchaseStatus,
    PartyExtended, PartyExtendedCreate, PartyExtendedUpdate,
    get_financial_year, calculate_brokerage_amount, calculate_bill_totals_new,
    calculate_bags_and_remaining, calculate_line_item_taxes, generate_bill_number
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

@router.get("/suppliers/search")
async def search_suppliers(q: str):
    """Real-time supplier search with fuzzy matching"""
    if len(q) < 2:  # Minimum 2 characters to search
        return []
    
    # Search by name (case insensitive) and GSTIN
    query = {
        "$and": [
            {"roles": "supplier"},
            {
                "$or": [
                    {"name": {"$regex": q, "$options": "i"}},
                    {"gstin": {"$regex": q, "$options": "i"}}
                ]
            }
        ]
    }
    
    suppliers = await db.parties.find(query, {
        "_id": 0,
        "id": 1,
        "name": 1,
        "gstin": 1,
        "place_of_supply": 1,
        "state": 1,
        "contact": 1
    }).limit(10).to_list(10)
    
    # Calculate similarity score for better sorting
    results = []
    for supplier in suppliers:
        name_similarity = calculate_similarity(q.lower(), supplier['name'].lower())
        gstin_match = 1.0 if q.upper() in (supplier.get('gstin') or '') else 0.0
        
        results.append({
            **supplier,
            "similarity_score": max(name_similarity, gstin_match)
        })
    
    # Sort by similarity score (highest first)
    results.sort(key=lambda x: x['similarity_score'], reverse=True)
    
    return results[:5]  # Return top 5 matches

def calculate_similarity(str1: str, str2: str) -> float:
    """Calculate similarity between two strings (0.0 to 1.0)"""
    if not str1 or not str2:
        return 0.0
    
    # Simple similarity based on common substrings
    if str1 in str2 or str2 in str1:
        return 0.9
    
    # Check for common words
    words1 = set(str1.split())
    words2 = set(str2.split())
    common_words = words1.intersection(words2)
    
    if common_words:
        return len(common_words) / max(len(words1), len(words2))
    
    return 0.0

@router.post("/suppliers/quick-create", response_model=PartyExtended)
async def quick_create_supplier(supplier_data: dict):
    """Quick supplier creation from pre-entry context"""
    print(f"[BACKEND] Received supplier data: {supplier_data}")
    
    # Validate required fields
    required_fields = ['name', 'place_of_supply', 'gstin', 'contact']
    for field in required_fields:
        if not supplier_data.get(field):
            print(f"[BACKEND] Missing required field: {field}")
            print(f"[BACKEND] Available fields: {list(supplier_data.keys())}")
            raise HTTPException(status_code=400, detail=f"{field} is required")
    
    # Check for duplicate GSTIN
    if supplier_data.get('gstin'):
        existing = await db.parties.find_one({
            "gstin": supplier_data['gstin'],
            "roles": "supplier"
        })
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Supplier with GSTIN {supplier_data['gstin']} already exists: {existing['name']}"
            )
    
    # Create new supplier
    supplier = PartyExtended(
        name=supplier_data['name'],
        roles=["supplier"],
        contact=supplier_data['contact'],
        gstin=supplier_data['gstin'],
        place_of_supply=supplier_data['place_of_supply'],
        state=supplier_data.get('state'),
        address=supplier_data.get('address'),
        pan=supplier_data.get('pan'),
        bank_name=supplier_data.get('bank_name'),
        account_number=supplier_data.get('account_number'),
        ifsc_code=supplier_data.get('ifsc_code')
    )
    
    doc = supplier.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('updated_at'):
        doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.parties.insert_one(doc)
    return supplier

@router.put("/suppliers/{supplier_id}/name")
async def update_supplier_name(supplier_id: str, name_update: dict):
    """Update supplier name"""
    new_name = name_update.get('new_name')
    if not new_name:
        raise HTTPException(status_code=400, detail="new_name is required")
    
    # Check if supplier exists
    supplier = await db.parties.find_one({"id": supplier_id, "roles": "supplier"})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Update name
    await db.parties.update_one(
        {"id": supplier_id},
        {"$set": {
            "name": new_name,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Supplier name updated to: {new_name}"}

@router.get("/suppliers", response_model=List[PartyExtended])
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

@router.post("/suppliers", response_model=PartyExtended)
async def create_extended_party(party_data: PartyExtendedCreate):
    """Create new party with extended fields"""
    party = PartyExtended(**party_data.model_dump())
    doc = party.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('updated_at'):
        doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.parties.insert_one(doc)
    return party

@router.get("/suppliers/{party_id}", response_model=PartyExtended)
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

@router.put("/suppliers/{party_id}", response_model=PartyExtended)
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
        
        # Get item details if item_id provided
        item_name = None
        if pre_entry_data.item_id:
            item = await db.items.find_one({"id": pre_entry_data.item_id})
            if item:
                item_name = item['name']
        
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
            item_id=pre_entry_data.item_id,
            item_name=item_name,
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
        {"slip_id": pre_entry_number}, 
        {"_id": 0}
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

async def create_brokerage_ledger_entries(
    bill_id: str,
    bill_number: str,
    broker_name: str,
    brokerage_amount: float
):
    """Create ledger entries for brokerage when bill is posted"""
    # Entry 1: Debit Trade Expenses
    trade_expense_entry = {
        "id": str(uuid.uuid4()),
        "bill_id": bill_id,
        "bill_number": bill_number,
        "account": "Trade Expenses",
        "type": "debit",
        "amount": brokerage_amount,
        "description": f"Brokerage for Bill {bill_number} - {broker_name}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Entry 2: Credit Brokerage Payable (with broker reference)
    brokerage_payable_entry = {
        "id": str(uuid.uuid4()),
        "bill_id": bill_id,
        "bill_number": bill_number,
        "account": "Brokerage Payable",
        "broker_name": broker_name,  # Reference to broker
        "type": "credit",
        "amount": brokerage_amount,
        "description": f"Brokerage payable for Bill {bill_number}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert ledger entries
    await db.ledger_entries.insert_many([trade_expense_entry, brokerage_payable_entry])
    print(f"[BACKEND] Created brokerage ledger entries for bill {bill_number}, amount: {brokerage_amount}")

@router.post("/bill-purchase", response_model=BillPurchase)
async def create_bill_purchase(bill_data: BillPurchaseCreate):
    """Create bill purchase after photo approval with new comprehensive structure"""
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
        
        # Generate bill number
        bill_number = generate_bill_number()
        
        # Use broker details from bill_data (editable during processing)
        # If not provided in bill_data, fall back to pre_entry values
        has_broker = bill_data.has_broker if bill_data.has_broker is not None else pre_entry.get('has_broker', False)
        broker_name = bill_data.broker_name or pre_entry.get('broker_name')
        brokerage_type = bill_data.brokerage_type or pre_entry.get('brokerage_type')
        brokerage_rate = bill_data.brokerage_rate if bill_data.brokerage_rate is not None else pre_entry.get('brokerage_rate', 0.0)
        
        # Calculate brokerage if applicable
        brokerage_amount = 0.0
        if has_broker and broker_name and brokerage_rate and brokerage_rate > 0:
            # Calculate based on line items
            line_items_total = sum(item.amount for item in bill_data.line_items)
            total_bags = sum(item.bags for item in bill_data.line_items)
            total_qtls = sum(item.agreed_weight for item in bill_data.line_items)
            
            brokerage_amount = calculate_brokerage_amount(
                brokerage_type,
                brokerage_rate,
                total_bags,
                total_qtls,
                line_items_total
            )
            print(f"[BACKEND] Calculated brokerage: {brokerage_amount} for broker {broker_name}")
        
        # Process line items to ensure all calculations are correct
        processed_line_items = []
        for item in bill_data.line_items:
            # Recalculate bags and remaining kg based on agreed weight and pack size
            bags, remaining_kg = calculate_bags_and_remaining(item.agreed_weight, item.pack_size)
            
            # Calculate item amount
            amount = round(item.agreed_weight * item.rate_per_qtl, 2)
            
            # Calculate taxes for this line item
            tax_calcs = calculate_line_item_taxes(
                amount, item.cgst_rate, item.sgst_rate, item.igst_rate
            )
            
            processed_item = BillPurchaseLineItem(
                item_id=item.item_id,
                item_name=item.item_name,
                quality=item.quality,
                pack_size=item.pack_size,
                bags=bags,
                remaining_kg=remaining_kg,
                actual_weight=item.actual_weight,
                agreed_weight=item.agreed_weight,
                rate_per_qtl=item.rate_per_qtl,
                amount=amount,
                cgst_rate=item.cgst_rate,
                sgst_rate=item.sgst_rate,
                igst_rate=item.igst_rate,
                cgst_amount=tax_calcs['cgst_amount'],
                sgst_amount=tax_calcs['sgst_amount'],
                igst_amount=tax_calcs['igst_amount'],
                sort_order=item.sort_order
            )
            processed_line_items.append(processed_item)
        
        # Calculate comprehensive totals
        totals = calculate_bill_totals_new(
            processed_line_items,
            bill_data.batav_percentage,
            bill_data.claim_type,
            bill_data.claim_rate
        )
        
        # Create bill purchase with new structure
        bill_purchase = BillPurchase(
            # Section 1: Bill Details
            bill_date=bill_data.bill_date,
            bill_number=bill_number,
            bill_type=bill_data.bill_type,
            vehicle_number=weighbridge_entry['vehicle_number'],
            
            # References
            pre_entry_id=bill_data.pre_entry_id,
            pre_entry_number=pre_entry['pre_entry_number'],
            weighbridge_slip_id=weighbridge_entry['slip_id'],
            
            # Section 2: Supplier Details
            supplier_id=pre_entry['supplier_id'],
            supplier_name=pre_entry['supplier_name'],
            supplier_gstin=pre_entry.get('supplier_gstin'),
            place_of_supply=pre_entry['place_of_supply'],
            
            # Broker details (editable during bill processing)
            has_broker=has_broker,
            broker_name=broker_name,
            brokerage_type=brokerage_type,
            brokerage_rate=brokerage_rate,
            brokerage_amount=brokerage_amount,
            
            # Section 3: Line Items
            line_items=processed_line_items,
            
            # Section 4: Adjustments
            batav_percentage=bill_data.batav_percentage,
            batav_amount=totals['batav_amount'],
            claim_type=bill_data.claim_type,
            claim_rate=bill_data.claim_rate,
            claim_amount=totals['claim_amount'],
            
            # Totals
            line_items_total=totals['line_items_total'],
            total_tax_amount=totals['total_tax_amount'],
            gross_amount=totals['gross_amount'],
            total_deductions=totals['total_deductions'],
            net_amount=totals['net_amount'],
            
            # Additional
            eway_bill_no=pre_entry.get('eway_bill_no'),
            remarks=bill_data.remarks,
            created_by=bill_data.created_by
        )
        
        # Save bill to database
        doc = bill_purchase.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        if doc.get('updated_at'):
            doc['updated_at'] = doc['updated_at'].isoformat()
        if doc.get('posted_at'):
            doc['posted_at'] = doc['posted_at'].isoformat()
        
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