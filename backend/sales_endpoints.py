"""
Sales Module - API Endpoints
"""
from fastapi import APIRouter, HTTPException
from sales_models import (
    SalesPreEntry, SalesPreEntryCreate, SalesPreEntryLineItem,
    SalesInvoice, SalesInvoiceCreate,
    SalesQueueItem, Marka,
    SalesStatus, SaleType,
    MixedLoadInvoiceCreate, MixedLoadInvoiceLineItem
)
from typing import List, Optional
from datetime import datetime, timezone
import uuid

router = APIRouter()
db = None

def init_db(database):
    global db
    db = database

# ============= HELPER FUNCTIONS =============

async def generate_sales_pre_entry_number() -> str:
    """Generate SPRE-YY-###### format"""
    from bill_purchase_models import get_financial_year
    
    fy_year = get_financial_year()
    
    # Find highest number for current FY
    existing = await db.sales_pre_entries.find(
        {"pre_entry_number": {"$regex": f"^SPRE-{fy_year:02d}-"}}
    ).sort("pre_entry_number", -1).limit(1).to_list(1)
    
    if existing:
        last_no = int(existing[0]['pre_entry_number'].split('-')[-1])
        new_no = last_no + 1
    else:
        new_no = 1
    
    return f"SPRE-{fy_year:02d}-{new_no:06d}"

async def create_sales_voucher(invoice_doc: dict):
    """Create voucher entries for sales invoice"""
    # TODO: Implement voucher creation logic
    # This will create ledger entries for:
    # - Customer account (debit)
    # - Sales account (credit)
    # - CGST account (credit)
    # - SGST account (credit)
    # - TCS account (credit)
    # - Broker account (debit)
    # - Freight account (debit)
    # - Round-off account (debit/credit)
    print(f"[BACKEND] Voucher creation placeholder for invoice: {invoice_doc['invoice_number']}")
    pass

async def generate_sales_invoice_number() -> str:
    """Generate SAL-YY-###### format"""
    from bill_purchase_models import get_financial_year
    
    fy_year = get_financial_year()
    
    # Find highest number for current FY
    existing = await db.sales_invoices.find(
        {"invoice_number": {"$regex": f"^SAL-{fy_year:02d}-"}}
    ).sort("invoice_number", -1).limit(1).to_list(1)
    
    if existing:
        last_no = int(existing[0]['invoice_number'].split('-')[-1])
        new_no = last_no + 1
    else:
        new_no = 1
    
    return f"SAL-{fy_year:02d}-{new_no:06d}"

def generate_qr_code_data(slip_id: str, transaction_type: str = "sale") -> str:
    """Generate QR code data string"""
    return f"{transaction_type.upper()}|{slip_id}|{datetime.now(timezone.utc).isoformat()}"

# ============= SALES PRE-ENTRY ENDPOINTS =============

@router.post("/sales/pre-entry", response_model=SalesPreEntry)
async def create_sales_pre_entry(pre_entry_data: SalesPreEntryCreate):
    """
    Create sales pre-entry.
    Supports both single-item and mixed-load scenarios.
    """
    try:
        # Generate pre-entry number
        pre_entry_number = await generate_sales_pre_entry_number()
        
        # Generate QR code data
        qr_data = generate_qr_code_data(pre_entry_number, "sale")
        
        # Handle Mixed Load
        if pre_entry_data.is_mixed_load:
            if not pre_entry_data.line_items or len(pre_entry_data.line_items) == 0:
                raise HTTPException(status_code=400, detail="Mixed load requires at least one line item")
            
            # Process line items
            processed_line_items = []
            total_expected_weight = 0
            
            for line_item_data in pre_entry_data.line_items:
                line_item = SalesPreEntryLineItem(
                    customer_id=line_item_data.customer_id,
                    customer_name=line_item_data.customer_name,
                    customer_gstin=line_item_data.customer_gstin,
                    place_of_supply=line_item_data.place_of_supply,
                    item_id=line_item_data.item_id,
                    item_name=line_item_data.item_name,
                    marka=line_item_data.marka,
                    bharti=line_item_data.bharti,
                    expected_bags=line_item_data.expected_bags,
                    expected_weight=line_item_data.expected_weight,
                    item_rate=line_item_data.item_rate
                )
                processed_line_items.append(line_item)
                total_expected_weight += line_item_data.expected_weight
            
            # Create mixed load pre-entry
            pre_entry = SalesPreEntry(
                pre_entry_number=pre_entry_number,
                slip_id=pre_entry_number,
                qr_code=qr_data,
                date=pre_entry_data.date,
                order_number=pre_entry_data.order_number,
                is_mixed_load=True,
                line_items=processed_line_items,
                customer_id=processed_line_items[0].customer_id,  # First customer for reference
                customer_name="MIXED LOAD",  # Indicator
                customer_gstin=None,
                place_of_supply=processed_line_items[0].place_of_supply,
                item_id=None,
                item_name=f"{len(processed_line_items)} Items",
                expected_weight=total_expected_weight,  # Store as number (kg)
                has_broker=pre_entry_data.has_broker,
                broker_id=pre_entry_data.broker_id,
                broker_name=pre_entry_data.broker_name,
                brokerage_type=pre_entry_data.brokerage_type,
                brokerage_rate=pre_entry_data.brokerage_rate,
                remarks=pre_entry_data.remarks,
                created_by=pre_entry_data.created_by
            )
            
            print(f"[BACKEND] Created mixed load sales pre-entry: {pre_entry_number} with {len(processed_line_items)} line items")
            
        else:
            # Single Item Pre-Entry (backward compatibility)
            # Get customer details
            customer = await db.parties.find_one({"id": pre_entry_data.customer_id})
            if not customer:
                raise HTTPException(status_code=404, detail="Customer not found")
            
            # Get item details if item_id provided
            item_name = None
            item_rate = pre_entry_data.item_rate
            
            if pre_entry_data.item_id:
                item = await db.items.find_one({"id": pre_entry_data.item_id})
                if item:
                    item_name = item['name']
                    # Auto-fill rate from item master if not provided
                    if item_rate is None:
                        item_rate = item.get('rate', 0.0)
            
            # Create single-item pre-entry
            pre_entry = SalesPreEntry(
                pre_entry_number=pre_entry_number,
                slip_id=pre_entry_number,
                qr_code=qr_data,
                date=pre_entry_data.date,
                order_number=pre_entry_data.order_number,
                is_mixed_load=False,
                line_items=[],
                customer_id=pre_entry_data.customer_id,
                customer_name=customer['name'],
                customer_gstin=pre_entry_data.customer_gstin or customer.get('gstin'),
                place_of_supply=pre_entry_data.place_of_supply,
                item_id=pre_entry_data.item_id,
                item_name=item_name,
                item_rate=item_rate,
                marka=pre_entry_data.marka,
                bharti=pre_entry_data.bharti,
                expected_weight=pre_entry_data.expected_weight,
                has_broker=pre_entry_data.has_broker,
                broker_id=pre_entry_data.broker_id,
                broker_name=pre_entry_data.broker_name,
                brokerage_type=pre_entry_data.brokerage_type,
                brokerage_rate=pre_entry_data.brokerage_rate,
                remarks=pre_entry_data.remarks,
                created_by=pre_entry_data.created_by
            )
            
            # Update marka memory if provided
            if pre_entry_data.marka and pre_entry_data.item_id:
                await update_marka_memory(pre_entry_data.item_id, item_name, pre_entry_data.marka)
            
            print(f"[BACKEND] Created single-item sales pre-entry: {pre_entry_number}")
        
        # Save to database
        doc = pre_entry.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        if doc.get('updated_at'):
            doc['updated_at'] = doc['updated_at'].isoformat()
        
        # Convert line_items to dict if present
        if doc.get('line_items'):
            doc['line_items'] = [item.model_dump() if hasattr(item, 'model_dump') else item for item in pre_entry.line_items]
        
        await db.sales_pre_entries.insert_one(doc)
        
        return pre_entry
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BACKEND] Error creating sales pre-entry: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/sales/pre-entries", response_model=List[SalesPreEntry])
async def list_sales_pre_entries(
    status: Optional[str] = None,
    limit: int = 100
):
    """List sales pre-entries with optional status filter"""
    query = {}
    if status:
        query["status"] = status
    
    pre_entries = await db.sales_pre_entries.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return pre_entries

@router.get("/sales/pre-entry/by-number/{pre_entry_number}")
async def get_sales_pre_entry_by_number(pre_entry_number: str):
    """Get sales pre-entry by number for weighbridge integration"""
    pre_entry = await db.sales_pre_entries.find_one(
        {"pre_entry_number": pre_entry_number},
        {"_id": 0}
    )
    
    if not pre_entry:
        raise HTTPException(status_code=404, detail="Pre-entry not found")
    
    # Check if already has weighbridge entries (tare + gross)
    weighbridge_entries = await db.weighbridge_entries.find(
        {"slip_id": pre_entry_number},
        {"_id": 0}
    ).to_list(length=None)
    
    # Find tare and gross entries
    tare_entry = None
    gross_entry = None
    
    for entry in weighbridge_entries:
        if entry.get('weight_type') == 'tare':
            tare_entry = entry
        elif entry.get('weight_type') == 'gross':
            gross_entry = entry
    
    # Calculate net weight if both exist
    net_weight = None
    if tare_entry and gross_entry:
        net_weight = gross_entry.get('weight', 0) - tare_entry.get('weight', 0)
    
    return {
        "pre_entry": pre_entry,
        "tare_entry": tare_entry,
        "gross_entry": gross_entry,
        "net_weight": net_weight,
        "weighbridge_completed": tare_entry is not None and gross_entry is not None
    }

# ============= MARKA MEMORY ENDPOINTS =============

async def update_marka_memory(item_id: str, item_name: str, marka: str):
    """Update or create marka memory for item"""
    existing = await db.marka_memory.find_one({
        "item_id": item_id,
        "marka": marka
    })
    
    if existing:
        # Update last_used timestamp
        await db.marka_memory.update_one(
            {"id": existing['id']},
            {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Create new marka entry
        marka_doc = Marka(
            item_id=item_id,
            item_name=item_name,
            marka=marka
        )
        doc = marka_doc.model_dump()
        doc['last_used'] = doc['last_used'].isoformat()
        await db.marka_memory.insert_one(doc)

@router.get("/sales/marka/{item_id}")
async def get_marka_for_item(item_id: str):
    """Get marka dropdown options for specific item"""
    markas = await db.marka_memory.find(
        {"item_id": item_id},
        {"_id": 0}
    ).sort("last_used", -1).to_list(length=20)  # Last 20 used markas
    
    return markas

# ============= SALES QUEUE ENDPOINT =============

@router.get("/sales/queue", response_model=List[SalesQueueItem])
async def get_sales_queue(
    status: Optional[str] = "pending",
    search: Optional[str] = None,
    date_filter: Optional[str] = None,
    limit: Optional[int] = 100
):
    """Get sales queue with filtering"""
    # Base query - only show entries with weighbridge completed (tare + gross)
    query = {
        "weighbridge_completed": True
    }
    
    # Status filter
    if status:
        query["status"] = status
    
    # Search filter
    if search:
        query["$or"] = [
            {"pre_entry_number": {"$regex": search, "$options": "i"}},
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"order_number": {"$regex": search, "$options": "i"}}
        ]
    
    # Date filter
    if date_filter == "today":
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        query["date"] = today
    
    # Get pre-entries
    pre_entries = await db.sales_pre_entries.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Build queue items
    queue_items = []
    for entry in pre_entries:
        queue_item = SalesQueueItem(
            pre_entry_id=entry['id'],
            pre_entry_number=entry['pre_entry_number'],
            slip_id=entry['slip_id'],
            date=entry['date'],
            customer_name=entry['customer_name'],
            customer_id=entry['customer_id'],  # For invoice creation
            place_of_supply=entry['place_of_supply'],  # For invoice creation
            item_id=entry.get('item_id'),  # For invoice creation
            item_name=entry.get('item_name'),
            marka=entry.get('marka'),
            bharti=entry.get('bharti', 50),  # Pack size
            rate=entry.get('item_rate') or entry.get('rate'),  # Rate per quintal for auto-fill (supports both field names)
            tare_weight=entry.get('tare_weight'),
            gross_weight=entry.get('gross_weight'),
            net_weight=entry.get('net_weight'),
            is_entry=entry.get('is_entry', False),  # Godown/Entry toggle
            is_mixed_load=entry.get('is_mixed_load', False),  # Mixed load indicator
            broker_name=entry.get('broker_name') if entry.get('has_broker') else None,
            brokerage_type=entry.get('brokerage_type'),  # For broker details
            brokerage_rate=entry.get('brokerage_rate'),  # For broker details
            status=entry['status'],
            weighbridge_completed=entry['weighbridge_completed'],
            created_at=datetime.fromisoformat(entry['created_at']) if isinstance(entry['created_at'], str) else entry['created_at'],
            weighed_at=None  # TODO: Get from weighbridge entries
        )
        
        queue_items.append(queue_item)
    
    return queue_items

# ============= SALES INVOICE ENDPOINTS =============

def calculate_brokerage_for_sales(
    brokerage_type: str,
    brokerage_rate: float,
    total_bags: int,
    total_qtls: float,
    subtotal: float
) -> float:
    """Calculate brokerage amount based on type"""
    if brokerage_type == "per_quintal":
        return round(brokerage_rate * total_qtls, 2)
    elif brokerage_type == "per_bag":
        return round(brokerage_rate * total_bags, 2)
    elif brokerage_type == "percentage":
        return round((subtotal * brokerage_rate / 100), 2)
    else:
        return 0.0

@router.post("/sales/invoice", response_model=dict)
async def create_sales_invoice(invoice_data: SalesInvoiceCreate):
    """Create sales invoice or sales return - Save & Post"""
    try:
        # Get pre-entry
        pre_entry = await db.sales_pre_entries.find_one({"id": invoice_data.pre_entry_id})
        if not pre_entry:
            raise HTTPException(status_code=404, detail="Sales pre-entry not found")
        
        if pre_entry['status'] != "pending":
            raise HTTPException(status_code=400, detail=f"Pre-entry status is {pre_entry['status']}, must be pending")
        
        # Generate invoice number (SAL-YY-######)
        invoice_number = await generate_sales_invoice_number()
        
        # Process line items
        line_items_processed = []
        subtotal = 0.0
        for item_data in invoice_data.line_items:
            line_item = {
                "item_id": item_data.get("item_id"),
                "item_name": item_data.get("item_name"),
                "marka": item_data.get("marka"),
                "bags": item_data.get("bags", 0),
                "kgs": item_data.get("kgs", 0.0),
                "bharti": item_data.get("bharti", 50),
                "actual_qtl": item_data.get("actual_qtl", 0.0),
                "rate": item_data.get("rate", 0.0),
                "amount": item_data.get("amount", 0.0)
            }
            line_items_processed.append(line_item)
            subtotal += line_item["amount"]
        
        # Calculation order (as per spec):
        # 1. Subtotal = Amount
        # 2. TCS = Subtotal × TCS% (BEFORE GST)
        # 3. CGST/SGST = (Subtotal + TCS) × GST%
        # 4. Grand Total = Subtotal + TCS + GST + Additional Charges
        # 5. Round Off
        
        tcs_amount = invoice_data.tcs_amount
        cgst_amount = invoice_data.cgst_amount
        sgst_amount = invoice_data.sgst_amount
        freight = invoice_data.freight or 0.0
        loading_charges = invoice_data.loading_charges or 0.0
        other_charges = invoice_data.other_charges or 0.0
        
        # Grand total (already calculated in frontend)
        grand_total = invoice_data.grand_total
        round_off = invoice_data.round_off
        
        # Create invoice document
        invoice_doc = {
            "id": str(uuid.uuid4()),
            "invoice_number": invoice_number,
            "sale_type": invoice_data.sale_type.value,
            "invoice_date": invoice_data.invoice_date,
            "pre_entry_id": invoice_data.pre_entry_id,
            "pre_entry_number": pre_entry['pre_entry_number'],
            "weighbridge_slip_no": invoice_data.weighbridge_slip_no,
            "customer_id": pre_entry['customer_id'],
            "customer_name": pre_entry['customer_name'],
            "customer_gstin": pre_entry.get('customer_gstin'),
            "place_of_supply": pre_entry['place_of_supply'],
            "is_entry": invoice_data.is_entry,
            
            # Consignee details (for freight/delivery)
            "consignee_same_as_customer": invoice_data.consignee_same_as_customer,
            "consignee_id": invoice_data.consignee_id,
            "consignee_name": invoice_data.consignee_name,
            "consignee_address": invoice_data.consignee_address,
            "consignee_city": invoice_data.consignee_city,
            "consignee_state": invoice_data.consignee_state,
            "consignee_pin_code": invoice_data.consignee_pin_code,
            
            "broker_name": invoice_data.broker_name,
            "brokerage_type": invoice_data.brokerage_type,
            "brokerage_rate": invoice_data.brokerage_rate,
            "line_items": line_items_processed,
            "cgst_rate": invoice_data.cgst_rate,
            "cgst_amount": cgst_amount,
            "sgst_rate": invoice_data.sgst_rate,
            "sgst_amount": sgst_amount,
            "freight": freight,
            "loading_charges": loading_charges,
            "other_charges": other_charges,
            "tcs_applicable": invoice_data.tcs_applicable,
            "tcs_rate": invoice_data.tcs_rate,
            "tcs_amount": tcs_amount,
            "subtotal": subtotal,
            "round_off": round_off,
            "grand_total": grand_total,
            "vehicle_number": pre_entry.get('vehicle_number'),
            "remarks": invoice_data.remarks,
            "status": "posted",  # Save = Post
            "posted_at": datetime.now(timezone.utc).isoformat(),
            "posted_by": invoice_data.created_by,
            "created_by": invoice_data.created_by,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None
        }
        
        # Save to database
        await db.sales_invoices.insert_one(invoice_doc)
        
        # Update pre-entry status to invoice_generated
        await db.sales_pre_entries.update_one(
            {"id": invoice_data.pre_entry_id},
            {"$set": {
                "status": "invoice_generated",
                "invoice_number": invoice_number,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Create voucher entries (placeholder for now)
        await create_sales_voucher(invoice_doc)
        
        print(f"[BACKEND] Created & Posted {'sales return' if invoice_data.sale_type == SaleType.SALES_RETURN else 'sales invoice'}: {invoice_number}")
        
        return {
            "id": invoice_doc["id"],
            "invoice_number": invoice_number,
            "sale_type": invoice_data.sale_type.value,
            "grand_total": grand_total,
            "status": "posted",
            "message": f"Invoice {invoice_number} created and posted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BACKEND] Error creating sales invoice: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/sales/invoice/{invoice_id}/post")
async def post_sales_invoice(invoice_id: str, user_id: str):
    """Post/finalize sales invoice and create voucher entries"""
    invoice = await db.sales_invoices.find_one({"id": invoice_id})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice['status'] != "draft":
        raise HTTPException(status_code=400, detail="Invoice is already posted or cancelled")
    
    # Update invoice status
    await db.sales_invoices.update_one(
        {"id": invoice_id},
        {"$set": {
            "status": "posted",
            "posted_at": datetime.now(timezone.utc).isoformat(),
            "posted_by": user_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # TODO: Create sales voucher entries
    # Will implement voucher logic here
    
    print(f"[BACKEND] Posted sales invoice: {invoice['invoice_number']}")
    
    return {"message": "Invoice posted successfully"}

@router.get("/sales/invoice/{invoice_id}")
async def get_sales_invoice(invoice_id: str):
    """Get sales invoice by ID"""
    invoice = await db.sales_invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

# ============= MIXED LOAD INVOICE ENDPOINTS =============

@router.post("/sales/mixed-load-invoice/bulk", response_model=dict)
async def create_mixed_load_invoices_bulk(invoice_data: MixedLoadInvoiceCreate, created_by: str):
    """
    Create multiple sales invoices from a single mixed load pre-entry.
    - Validates total allocated weight is within ±100 kg of actual net weight
    - Generates one invoice per line item
    - Distributes broker commission proportionally across invoices
    """
    try:
        # 1. Fetch the mixed load pre-entry
        pre_entry = await db.sales_pre_entries.find_one({"id": invoice_data.pre_entry_id})
        if not pre_entry:
            raise HTTPException(status_code=404, detail="Sales pre-entry not found")
        
        # 2. Verify it's a mixed load
        if not pre_entry.get('is_mixed_load', False):
            raise HTTPException(status_code=400, detail="Pre-entry is not a mixed load")
        
        # 3. Verify pre-entry status
        if pre_entry['status'] != "pending":
            raise HTTPException(status_code=400, detail=f"Pre-entry status is {pre_entry['status']}, must be pending")
        
        # 4. Verify weighbridge data exists
        if not pre_entry.get('weighbridge_completed') or not pre_entry.get('net_weight'):
            raise HTTPException(status_code=400, detail="Weighbridge data not completed for this pre-entry")
        
        actual_net_weight = pre_entry['net_weight']  # In kg
        
        # 5. Validate total allocated weight (±100 kg variance allowed)
        total_allocated_weight = sum(item.actual_weight for item in invoice_data.line_items)
        weight_variance = abs(total_allocated_weight - actual_net_weight)
        
        if weight_variance > 100:
            raise HTTPException(
                status_code=400, 
                detail=f"Total allocated weight ({total_allocated_weight} kg) differs from actual net weight ({actual_net_weight} kg) by {weight_variance} kg. Maximum allowed variance is ±100 kg."
            )
        
        # 6. Map line_items by line_id for easy access
        line_item_dict = {}
        for pre_entry_line in pre_entry.get('line_items', []):
            line_item_dict[pre_entry_line['line_id']] = pre_entry_line
        
        # 7. Calculate total broker commission and proportional distribution
        total_commission = 0.0
        if invoice_data.broker_name and invoice_data.brokerage_rate:
            brokerage_type = invoice_data.brokerage_type or "per_quintal"
            
            if brokerage_type == "per_quintal":
                total_qtl = sum(item.actual_qtl for item in invoice_data.line_items)
                total_commission = total_qtl * invoice_data.brokerage_rate
            elif brokerage_type == "per_bag":
                total_bags = sum(item.actual_bags for item in invoice_data.line_items)
                total_commission = total_bags * invoice_data.brokerage_rate
            elif brokerage_type == "percentage":
                # Will calculate per invoice based on invoice amount
                pass
        
        # 8. Create invoices for each line item
        created_invoices = []
        
        for invoice_line in invoice_data.line_items:
            # Get corresponding pre-entry line item
            pre_line = line_item_dict.get(invoice_line.line_id)
            if not pre_line:
                raise HTTPException(status_code=400, detail=f"Line item {invoice_line.line_id} not found in pre-entry")
            
            # Generate invoice number
            invoice_number = await generate_sales_invoice_number()
            
            # Calculate line item amount
            item_rate = pre_line.get('item_rate', 0.0)
            line_amount = invoice_line.actual_qtl * item_rate
            subtotal = line_amount
            
            # Calculate proportional broker commission
            proportional_commission = 0.0
            if invoice_data.broker_name and invoice_data.brokerage_rate:
                brokerage_type = invoice_data.brokerage_type or "per_quintal"
                
                if brokerage_type == "per_quintal":
                    proportional_commission = invoice_line.actual_qtl * invoice_data.brokerage_rate
                elif brokerage_type == "per_bag":
                    proportional_commission = invoice_line.actual_bags * invoice_data.brokerage_rate
                elif brokerage_type == "percentage":
                    proportional_commission = (subtotal * invoice_data.brokerage_rate) / 100
            
            # GST calculation (assuming 5% CGST + 5% SGST = 10% total GST)
            cgst_rate = 2.5  # 2.5% CGST
            sgst_rate = 2.5  # 2.5% SGST
            cgst_amount = (subtotal * cgst_rate) / 100
            sgst_amount = (subtotal * sgst_rate) / 100
            
            # Calculate grand total
            grand_total = subtotal + cgst_amount + sgst_amount
            
            # Round off to nearest rupee
            rounded_total = round(grand_total)
            round_off = rounded_total - grand_total
            
            # Prepare line item for invoice
            invoice_line_item = {
                "item_id": pre_line['item_id'],
                "item_name": pre_line['item_name'],
                "marka": pre_line.get('marka'),
                "bags": invoice_line.actual_bags,
                "kgs": invoice_line.actual_kgs,
                "bharti": pre_line.get('bharti', 50),
                "actual_qtl": invoice_line.actual_qtl,
                "rate": item_rate,
                "amount": line_amount
            }
            
            # Create invoice document
            invoice_doc = {
                "id": str(uuid.uuid4()),
                "invoice_number": invoice_number,
                "sale_type": "normal_sale",
                "invoice_date": invoice_data.invoice_date,
                "pre_entry_id": invoice_data.pre_entry_id,
                "pre_entry_number": pre_entry['pre_entry_number'],
                "pre_entry_line_id": invoice_line.line_id,  # Link back to line item
                "weighbridge_slip_no": invoice_data.weighbridge_slip_no,
                "customer_id": pre_line['customer_id'],
                "customer_name": pre_line['customer_name'],
                "customer_gstin": pre_line.get('customer_gstin'),
                "place_of_supply": pre_line['place_of_supply'],
                "is_entry": invoice_data.is_entry,
                "broker_name": invoice_data.broker_name,
                "brokerage_type": invoice_data.brokerage_type,
                "brokerage_rate": invoice_data.brokerage_rate,
                "broker_commission": proportional_commission,
                "line_items": [invoice_line_item],
                "cgst_rate": cgst_rate,
                "cgst_amount": cgst_amount,
                "sgst_rate": sgst_rate,
                "sgst_amount": sgst_amount,
                "freight": 0.0,  # Can be distributed if needed
                "loading_charges": 0.0,
                "other_charges": 0.0,
                "tcs_applicable": False,
                "tcs_rate": None,
                "tcs_amount": 0.0,
                "subtotal": subtotal,
                "round_off": round_off,
                "grand_total": rounded_total,
                "vehicle_number": pre_entry.get('vehicle_number'),
                "remarks": invoice_data.remarks,
                "status": "posted",
                "posted_at": datetime.now(timezone.utc).isoformat(),
                "posted_by": created_by,
                "created_by": created_by,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": None
            }
            
            # Save invoice to database
            await db.sales_invoices.insert_one(invoice_doc)
            
            # Update line item in pre-entry with invoice_id
            await db.sales_pre_entries.update_one(
                {"id": invoice_data.pre_entry_id, "line_items.line_id": invoice_line.line_id},
                {"$set": {
                    "line_items.$.invoice_id": invoice_doc["id"],
                    "line_items.$.actual_weight": invoice_line.actual_weight
                }}
            )
            
            # Create voucher entries
            await create_sales_voucher(invoice_doc)
            
            created_invoices.append({
                "invoice_id": invoice_doc["id"],
                "invoice_number": invoice_number,
                "customer_name": pre_line['customer_name'],
                "item_name": pre_line['item_name'],
                "actual_qtl": invoice_line.actual_qtl,
                "grand_total": rounded_total,
                "broker_commission": proportional_commission
            })
            
            print(f"[BACKEND] Created invoice {invoice_number} for customer {pre_line['customer_name']}")
        
        # 9. Update pre-entry status to invoice_generated
        await db.sales_pre_entries.update_one(
            {"id": invoice_data.pre_entry_id},
            {"$set": {
                "status": "invoice_generated",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        print(f"[BACKEND] Created {len(created_invoices)} invoices from mixed load pre-entry {pre_entry['pre_entry_number']}")
        
        return {
            "success": True,
            "pre_entry_number": pre_entry['pre_entry_number'],
            "total_invoices_created": len(created_invoices),
            "total_weight_allocated": total_allocated_weight,
            "actual_net_weight": actual_net_weight,
            "weight_variance": weight_variance,
            "total_broker_commission": sum(inv['broker_commission'] for inv in created_invoices),
            "invoices": created_invoices,
            "message": f"Successfully created {len(created_invoices)} invoices from mixed load"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BACKEND] Error creating mixed load invoices: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/sales/mixed-load-invoice/create-all", response_model=dict)
async def create_all_mixed_load_invoices(
    pre_entry_id: str,
    invoice_date: str,
    weighbridge_slip_no: str,
    is_entry: bool = False,
    remarks: Optional[str] = None,
    created_by: str = "system"
):
    """
    Create All invoices with auto weight allocation based on pre-entry expected weights.
    - Automatically distributes actual net weight proportionally across line items
    - Based on expected_weight in each line item
    """
    try:
        # 1. Fetch the mixed load pre-entry
        pre_entry = await db.sales_pre_entries.find_one({"id": pre_entry_id})
        if not pre_entry:
            raise HTTPException(status_code=404, detail="Sales pre-entry not found")
        
        # 2. Verify it's a mixed load
        if not pre_entry.get('is_mixed_load', False):
            raise HTTPException(status_code=400, detail="Pre-entry is not a mixed load")
        
        # 3. Verify pre-entry status
        if pre_entry['status'] != "pending":
            raise HTTPException(status_code=400, detail=f"Pre-entry status is {pre_entry['status']}, must be pending")
        
        # 4. Verify weighbridge data exists
        if not pre_entry.get('weighbridge_completed') or not pre_entry.get('net_weight'):
            raise HTTPException(status_code=400, detail="Weighbridge data not completed for this pre-entry")
        
        actual_net_weight = pre_entry['net_weight']  # In kg
        line_items = pre_entry.get('line_items', [])
        
        if not line_items:
            raise HTTPException(status_code=400, detail="No line items found in pre-entry")
        
        # 5. Calculate total expected weight
        total_expected_weight = sum(item.get('expected_weight', 0) for item in line_items)
        
        if total_expected_weight <= 0:
            raise HTTPException(status_code=400, detail="Total expected weight is zero, cannot auto-allocate")
        
        # 6. Auto-allocate weights proportionally
        allocated_line_items = []
        total_allocated = 0
        
        for i, line_item in enumerate(line_items):
            expected_weight = line_item.get('expected_weight', 0)
            
            # For the last item, allocate remaining weight to avoid rounding errors
            if i == len(line_items) - 1:
                actual_weight = actual_net_weight - total_allocated
            else:
                # Proportional allocation
                proportion = expected_weight / total_expected_weight
                actual_weight = actual_net_weight * proportion
                total_allocated += actual_weight
            
            # Calculate bags and remainder kg
            bharti = line_item.get('bharti', 50)
            actual_bags = int(actual_weight // bharti)
            actual_kgs = actual_weight % bharti
            actual_qtl = actual_weight / 100  # Convert kg to quintals
            
            allocated_line_items.append(
                MixedLoadInvoiceLineItem(
                    line_id=line_item['line_id'],
                    actual_weight=actual_weight,
                    actual_bags=actual_bags,
                    actual_kgs=actual_kgs,
                    actual_qtl=actual_qtl
                )
            )
        
        # 7. Create MixedLoadInvoiceCreate object
        mixed_load_invoice_data = MixedLoadInvoiceCreate(
            pre_entry_id=pre_entry_id,
            invoice_date=invoice_date,
            weighbridge_slip_no=weighbridge_slip_no,
            is_entry=is_entry,
            line_items=allocated_line_items,
            broker_id=pre_entry.get('broker_id'),
            broker_name=pre_entry.get('broker_name'),
            brokerage_type=pre_entry.get('brokerage_type', 'per_quintal'),
            brokerage_rate=pre_entry.get('brokerage_rate'),
            freight=0.0,
            remarks=remarks
        )
        
        # 8. Call the bulk invoice creation endpoint
        result = await create_mixed_load_invoices_bulk(mixed_load_invoice_data, created_by)
        
        result['auto_allocated'] = True
        result['allocation_method'] = "proportional_by_expected_weight"
        
        print(f"[BACKEND] Auto-allocated and created {result['total_invoices_created']} invoices for pre-entry {pre_entry['pre_entry_number']}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BACKEND] Error in create-all mixed load invoices: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
