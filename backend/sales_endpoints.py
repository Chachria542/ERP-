"""
Sales Module - API Endpoints
"""
from fastapi import APIRouter, HTTPException
from sales_models import (
    SalesPreEntry, SalesPreEntryCreate,
    SalesInvoice, SalesInvoiceCreate,
    SalesQueueItem, Marka,
    SalesStatus, SaleType
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
    """Create sales pre-entry"""
    try:
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
        
        # Generate pre-entry number
        pre_entry_number = await generate_sales_pre_entry_number()
        
        # Generate QR code data
        qr_data = generate_qr_code_data(pre_entry_number, "sale")
        
        # Create pre-entry
        pre_entry = SalesPreEntry(
            pre_entry_number=pre_entry_number,
            slip_id=pre_entry_number,
            qr_code=qr_data,
            date=pre_entry_data.date,
            order_number=pre_entry_data.order_number,
            customer_id=pre_entry_data.customer_id,
            customer_name=customer['name'],
            customer_gstin=pre_entry_data.customer_gstin or customer.get('gstin'),
            place_of_supply=pre_entry_data.place_of_supply,
            is_mandi=pre_entry_data.is_mandi,
            location_name=pre_entry_data.location_name,
            item_id=pre_entry_data.item_id,
            item_name=item_name,
            item_rate=item_rate,
            marka=pre_entry_data.marka,
            bharti=pre_entry_data.bharti,
            expected_bags=pre_entry_data.expected_bags,
            expected_kgs=pre_entry_data.expected_kgs,
            has_broker=pre_entry_data.has_broker,
            broker_id=pre_entry_data.broker_id,
            broker_name=pre_entry_data.broker_name,
            brokerage_type=pre_entry_data.brokerage_type,
            brokerage_rate=pre_entry_data.brokerage_rate,
            remarks=pre_entry_data.remarks,
            created_by=pre_entry_data.created_by
        )
        
        # Save to database
        doc = pre_entry.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        if doc.get('updated_at'):
            doc['updated_at'] = doc['updated_at'].isoformat()
        
        await db.sales_pre_entries.insert_one(doc)
        
        # Update marka memory if provided
        if pre_entry_data.marka and pre_entry_data.item_id:
            await update_marka_memory(pre_entry_data.item_id, item_name, pre_entry_data.marka)
        
        print(f"[BACKEND] Created sales pre-entry: {pre_entry_number}")
        return pre_entry
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BACKEND] Error creating sales pre-entry: {e}")
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
            item_name=entry.get('item_name'),
            marka=entry.get('marka'),
            tare_weight=entry.get('tare_weight'),
            gross_weight=entry.get('gross_weight'),
            net_weight=entry.get('net_weight'),
            broker_name=entry.get('broker_name') if entry.get('has_broker') else None,
            status=entry['status'],
            weighbridge_completed=entry['weighbridge_completed'],
            created_at=datetime.fromisoformat(entry['created_at']) if isinstance(entry['created_at'], str) else entry['created_at'],
            weighed_at=None  # TODO: Get from weighbridge entries
        )
        
        queue_items.append(queue_item)
    
    return queue_items

# ============= SALES INVOICE ENDPOINTS (Phase 4 - Coming Next) =============
# Will be implemented in Phase 4
