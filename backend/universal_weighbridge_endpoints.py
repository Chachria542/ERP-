"""
Universal Weighbridge System - API Endpoints
Handles pre-entries (office) and weighbridge entries (operator)
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from universal_weighbridge_models import (
    PreEntry, PreEntryCreate, PreEntryStatus,
    WeighbridgeEntry, WeighbridgeEntryCreate, WeighbridgeStatus,
    Farmer, FarmerCreate,
    TransactionType, PartyType, PhotoUploadStatus,
    calculate_quantities, generate_qr_code_data
)
from typing import List, Optional
import uuid

router = APIRouter()
db = None

def init_db(database):
    global db
    db = database

# ============= HELPER FUNCTIONS =============

def get_financial_year() -> int:
    """Get current financial year (Apr-Mar) for slip ID"""
    now = datetime.now(timezone.utc)
    if now.month >= 4:
        return now.year % 100
    else:
        return (now.year - 1) % 100

async def generate_slip_id() -> str:
    """Generate unique slip ID: WB-YY-######"""
    fy_year = get_financial_year()
    
    # Get last slip for this FY
    last_entry = await db.pre_entries.find_one(
        {"slip_id": {"$regex": f"^WB-{fy_year:02d}-"}},
        sort=[("slip_id", -1)]
    )
    
    if last_entry:
        last_no = int(last_entry['slip_id'].split('-')[-1])
        new_no = last_no + 1
    else:
        new_no = 1
    
    return f"WB-{fy_year:02d}-{new_no:06d}"

async def get_or_create_farmer(mobile: str, name: str, city: Optional[str] = None) -> tuple:
    """
    Get existing farmer or create new one.
    Preserves OTP verification status from otp_verifications collection.
    Returns: (farmer_id, name_conflict: bool, existing_name: str)
    """
    existing = await db.farmers.find_one({"mobile": mobile})
    
    if existing:
        # Check for name conflict
        if existing['name'].lower().strip() != name.lower().strip():
            return existing['id'], True, existing['name']
        return existing['id'], False, None
    
    # Check for successful OTP verification before creating farmer
    otp_verification = await db.otp_verifications.find_one(
        {"mobile": mobile, "verified": True},
        sort=[("created_at", -1)]  # Get latest verification
    )
    
    # Create new farmer with OTP verification status preserved
    if otp_verification:
        farmer = Farmer(
            mobile=mobile, 
            name=name, 
            city=city,
            mobile_verified=True,
            mobile_verified_at=datetime.now(timezone.utc),
            otp_verified_count=1
        )
    else:
        farmer = Farmer(mobile=mobile, name=name, city=city)
    
    doc = farmer.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('mobile_verified_at'):
        doc['mobile_verified_at'] = doc['mobile_verified_at'].isoformat()
    await db.farmers.insert_one(doc)
    
    return farmer.id, False, None

async def log_audit(user_id: str, user_name: str, action: str, entity_type: str, 
                   entity_id: str, old_value: dict = None, new_value: dict = None):
    """Create audit log entry"""
    from universal_weighbridge_models import AuditLog
    
    log = AuditLog(
        user_id=user_id,
        user_name=user_name,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value
    )
    
    doc = log.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.audit_logs.insert_one(doc)

# ============= PRE-ENTRY ENDPOINTS (Office Side) =============

@router.post("/pre-entry")
async def create_pre_entry(entry_data: PreEntryCreate):
    """
    Create pre-entry (office staff creates this BEFORE truck arrives).
    Generates slip_id and QR code.
    """
    try:
        # Generate slip ID
        slip_id = await generate_slip_id()
        
        # Get item details
        item = await db.items.find_one({"id": entry_data.item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        
        # Handle farmer auto-creation for farmer transactions
        party_id = None
        farmer_conflict = False
        existing_farmer_name = None
        
        if entry_data.party_type == PartyType.FARMER and entry_data.party_mobile:
            party_id, farmer_conflict, existing_farmer_name = await get_or_create_farmer(
                mobile=entry_data.party_mobile,
                name=entry_data.party_name,
                city=None  # City not in create request
            )
            
            # If name conflict, return warning (frontend will ask for confirmation)
            if farmer_conflict:
                return {
                    "farmer_conflict": True,
                    "existing_name": existing_farmer_name,
                    "new_name": entry_data.party_name,
                    "mobile": entry_data.party_mobile
                }
        
        # Generate QR code data
        qr_code = generate_qr_code_data(slip_id, entry_data.transaction_type)
        
        # Create pre-entry
        pre_entry = PreEntry(
            slip_id=slip_id,
            qr_code=qr_code,
            party_id=party_id,
            item_name=item['name'],
            **entry_data.model_dump()
        )
        
        # Save to database
        doc = pre_entry.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['transaction_type'] = doc['transaction_type'].value
        doc['party_type'] = doc['party_type'].value
        doc['status'] = doc['status'].value
        await db.pre_entries.insert_one(doc)
        
        # Log audit
        await log_audit(
            user_id=entry_data.created_by,
            user_name="Unknown",  # TODO: Get from user context
            action="create",
            entity_type="pre_entry",
            entity_id=pre_entry.id,
            new_value=doc
        )
        
        return pre_entry
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/pre-entry/confirm-farmer-update")
async def create_pre_entry_with_farmer_update(entry_data: PreEntryCreate, confirm_update: bool = True):
    """Create pre-entry and update farmer name if confirmed"""
    if not confirm_update:
        raise HTTPException(status_code=400, detail="Farmer update not confirmed")
    
    # Update farmer name
    await db.farmers.update_one(
        {"mobile": entry_data.party_mobile},
        {"$set": {
            "name": entry_data.party_name,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create pre-entry (will not return conflict now)
    return await create_pre_entry(entry_data)

@router.get("/pre-entry/{slip_id}")
async def get_pre_entry_universal(slip_id: str):
    """
    Universal pre-entry lookup by slip ID.
    Handles both farmer purchase (WB-XX-XXXXXX) and bill purchase (BPRE-XX-XXXXXX) pre-entries.
    """
    # Check if it's a bill purchase pre-entry (starts with BPRE)
    if slip_id.startswith("BPRE-"):
        entry = await db.bill_purchase_pre_entries.find_one({"pre_entry_number": slip_id}, {"_id": 0})
        
        if not entry:
            raise HTTPException(status_code=404, detail="Bill purchase pre-entry not found")
        
        # Convert to universal format for weighbridge
        return {
            "id": entry['id'],
            "slip_id": entry['slip_id'],  # Same as pre_entry_number for bill purchase
            "transaction_type": "bill_purchase",
            "party_name": entry['supplier_name'],
            "party_mobile": None,  # Suppliers don't have mobile in bill purchase
            "party_gstin": entry.get('supplier_gstin'),
            "item_id": entry.get('item_id'),
            "item_name": entry.get('item_name'),
            "from_location": "Warehouse",  # Default for bill purchase
            "to_location": None,
            "status": entry['status'],
            "created_at": entry['created_at'],
            "created_by": entry['created_by'],
            "eway_bill_no": entry.get('eway_bill_no'),
            "place_of_supply": entry['place_of_supply'],
            "has_broker": entry['has_broker'],
            "broker_name": entry.get('broker_name')
        }
    else:
        # Regular farmer purchase pre-entry
        entry = await db.pre_entries.find_one({"slip_id": slip_id}, {"_id": 0})
        
        if not entry:
            raise HTTPException(status_code=404, detail="Pre-entry not found")
        
        # Convert datetime strings back
        if isinstance(entry.get('created_at'), str):
            entry['created_at'] = datetime.fromisoformat(entry['created_at'])
        
        return entry

@router.get("/pre-entries", response_model=List[PreEntry])
async def get_pre_entries(status: Optional[str] = None, transaction_type: Optional[str] = None):
    """Get all pre-entries with optional filters"""
    query = {}
    if status:
        query['status'] = status
    if transaction_type:
        query['transaction_type'] = transaction_type
    
    entries = await db.pre_entries.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for entry in entries:
        if isinstance(entry.get('created_at'), str):
            entry['created_at'] = datetime.fromisoformat(entry['created_at'])
    
    return entries

# ============= WEIGHBRIDGE ENTRY ENDPOINTS (Operator Side) =============

@router.post("/weighbridge-entry", response_model=WeighbridgeEntry)
async def create_weighbridge_entry(entry_data: WeighbridgeEntryCreate):
    """
    Create weighbridge entry after scanning QR and weighing truck.
    Links to existing pre-entry.
    """
    try:
        # Universal pre-entry lookup
        slip_id = entry_data.slip_id
        pre_entry = None
        is_bill_purchase = slip_id.startswith("BPRE-")
        
        if is_bill_purchase:
            # Look in bill purchase pre-entries
            pre_entry = await db.bill_purchase_pre_entries.find_one({"pre_entry_number": slip_id})
            if not pre_entry:
                raise HTTPException(status_code=404, detail="Bill purchase pre-entry not found. Invalid slip ID.")
        else:
            # Look in regular pre-entries
            pre_entry = await db.pre_entries.find_one({"slip_id": slip_id})
            if not pre_entry:
                raise HTTPException(status_code=404, detail="Pre-entry not found. Invalid slip ID.")
        
        # Check if already weighed
        existing = await db.weighbridge_entries.find_one({"slip_id": entry_data.slip_id})
        if existing:
            raise HTTPException(status_code=400, detail="Slip already weighed")
        
        # Calculate net weight and quantities
        net_weight = entry_data.gross_weight - entry_data.tare_weight
        
        if net_weight <= 0:
            raise HTTPException(status_code=400, detail="Gross weight must be greater than tare weight")
        
        quantities = calculate_quantities(net_weight)
        
        # Mock photo URLs (will be replaced with real S3 URLs)
        mock_photos = [
            "https://via.placeholder.com/800x600.png?text=Gross+Weight",
            "https://via.placeholder.com/800x600.png?text=Tare+Weight"
        ]
        
        # Determine transaction type based on slip format
        transaction_type = TransactionType.BILL_PURCHASE if is_bill_purchase else TransactionType(pre_entry['transaction_type'])
        
        # Create weighbridge entry
        wb_entry = WeighbridgeEntry(
            pre_entry_id=pre_entry['id'],
            slip_id=entry_data.slip_id,
            transaction_type=transaction_type,
            vehicle_number=entry_data.vehicle_number,
            vehicle_type=entry_data.vehicle_type,
            driver_name=entry_data.driver_name,
            driver_mobile=entry_data.driver_mobile,
            gross_weight=entry_data.gross_weight,
            tare_weight=entry_data.tare_weight,
            net_weight=net_weight,
            bags=quantities['bags'],
            rem_kg=quantities['rem_kg'],
            act_qtl=quantities['act_qtl'],
            photo_gross_url=mock_photos[0],
            photo_tare_url=mock_photos[1],
            operator_id=entry_data.operator_id,
            operator_name=entry_data.operator_name,
            shift=entry_data.shift
        )
        
        # Save to database
        doc = wb_entry.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['weighed_at'] = doc['weighed_at'].isoformat()
        doc['photo_gross_timestamp'] = doc['photo_gross_timestamp'].isoformat()
        doc['photo_tare_timestamp'] = doc['photo_tare_timestamp'].isoformat()
        doc['transaction_type'] = doc['transaction_type'].value
        doc['status'] = doc['status'].value
        doc['photo_upload_status'] = doc['photo_upload_status'].value
        await db.weighbridge_entries.insert_one(doc)
        
        # Update pre-entry status in correct collection
        if is_bill_purchase:
            await db.bill_purchase_pre_entries.update_one(
                {"pre_entry_number": entry_data.slip_id},
                {"$set": {
                    "status": "pending",  # Bill purchase goes to pending after weighbridge
                    "weighbridge_completed": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            await db.pre_entries.update_one(
                {"slip_id": entry_data.slip_id},
                {"$set": {"status": PreEntryStatus.WEIGHED.value}}
            )
        
        # Log audit
        await log_audit(
            user_id=entry_data.operator_id,
            user_name=entry_data.operator_name,
            action="create",
            entity_type="weighbridge_entry",
            entity_id=wb_entry.id,
            new_value=doc
        )
        
        return wb_entry
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/weighbridge-entry/{slip_id}")
async def get_weighbridge_entry(slip_id: str):
    """
    Fetch weighbridge entry by slip ID.
    Used by downstream modules (Farmer Payment, Bill Purchase, etc.)
    """
    # Fetch weighbridge entry
    wb_entry = await db.weighbridge_entries.find_one({"slip_id": slip_id}, {"_id": 0})
    
    if not wb_entry:
        raise HTTPException(status_code=404, detail="Weighbridge entry not found")
    
    # Fetch linked pre-entry (check both collections)
    pre_entry = None
    if slip_id.startswith("BPRE-"):
        pre_entry = await db.bill_purchase_pre_entries.find_one({"pre_entry_number": slip_id}, {"_id": 0})
        if pre_entry:
            # Convert to universal format
            pre_entry = {
                "party_name": pre_entry['supplier_name'],
                "party_mobile": None,
                "party_gstin": pre_entry.get('supplier_gstin'),
                "transaction_type": "bill_purchase",
                "eway_bill_no": pre_entry.get('eway_bill_no'),
                "place_of_supply": pre_entry['place_of_supply']
            }
    else:
        pre_entry = await db.pre_entries.find_one({"slip_id": slip_id}, {"_id": 0})
    
    # Combine data for auto-fill
    combined = {
        **wb_entry,
        "party_name": pre_entry.get('party_name'),
        "party_mobile": pre_entry.get('party_mobile'),
        "item_id": pre_entry.get('item_id'),
        "item_name": pre_entry.get('item_name'),
        "quality": pre_entry.get('quality'),
        "rate_per_qtl": pre_entry.get('rate_per_qtl'),
        "from_location": pre_entry.get('from_location'),
        "to_location": pre_entry.get('to_location'),
    }
    
    # Convert datetime strings
    for key in ['created_at', 'weighed_at', 'photo_gross_timestamp', 'photo_tare_timestamp']:
        if isinstance(combined.get(key), str):
            combined[key] = datetime.fromisoformat(combined[key])
    
    return combined

@router.get("/weighbridge-entries", response_model=List[WeighbridgeEntry])
async def get_weighbridge_entries(transaction_type: Optional[str] = None):
    """Get all weighbridge entries with optional filter"""
    query = {}
    if transaction_type:
        query['transaction_type'] = transaction_type
    
    entries = await db.weighbridge_entries.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for entry in entries:
        for key in ['created_at', 'weighed_at', 'photo_gross_timestamp', 'photo_tare_timestamp']:
            if isinstance(entry.get(key), str):
                entry[key] = datetime.fromisoformat(entry[key])
    
    return entries

# ============= FARMER MASTER ENDPOINTS =============

@router.get("/farmers", response_model=List[Farmer])
async def get_farmers():
    """Get all farmers"""
    farmers = await db.farmers.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    
    for farmer in farmers:
        if isinstance(farmer.get('created_at'), str):
            farmer['created_at'] = datetime.fromisoformat(farmer['created_at'])
        if isinstance(farmer.get('updated_at'), str):
            farmer['updated_at'] = datetime.fromisoformat(farmer['updated_at'])
    
    return farmers

@router.get("/farmer/{mobile}", response_model=Farmer)
async def get_farmer(mobile: str):
    """Get farmer by mobile number"""
    farmer = await db.farmers.find_one({"mobile": mobile}, {"_id": 0})
    
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    
    if isinstance(farmer.get('created_at'), str):
        farmer['created_at'] = datetime.fromisoformat(farmer['created_at'])
    
    return farmer
