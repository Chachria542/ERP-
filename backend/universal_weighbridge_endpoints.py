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

# Import queue models
from weighbridge_queue_models import WeighbridgeQueueItem, WeighbridgeQueueResponse


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
    Handles farmer purchase (WB-XX-XXXXXX), bill purchase (BPRE-XX-XXXXXX), and sales (SPRE-XX-XXXXXX) pre-entries.
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
    elif slip_id.startswith("SPRE-"):
        # Sales pre-entry
        entry = await db.sales_pre_entries.find_one({"pre_entry_number": slip_id}, {"_id": 0})
        
        if not entry:
            raise HTTPException(status_code=404, detail="Sales pre-entry not found")
        
        # If TARE weight exists, fetch vehicle number from TARE weighbridge entry
        vehicle_number_from_tare = None
        if entry.get('tare_weight') and entry.get('tare_weight') > 0:
            tare_wb_entry = await db.weighbridge_entries.find_one(
                {"slip_id": slip_id, "weight_type": "tare"},
                {"_id": 0, "vehicle_number": 1}
            )
            if tare_wb_entry:
                vehicle_number_from_tare = tare_wb_entry.get('vehicle_number')
        
        # Convert to universal format for weighbridge
        return {
            "id": entry['id'],
            "slip_id": entry['slip_id'],  # Same as pre_entry_number for sales
            "transaction_type": "sale",
            "customer_name": entry['customer_name'],
            "party_name": entry['customer_name'],  # For backward compatibility
            "party_mobile": None,
            "party_gstin": entry.get('customer_gstin'),
            "item_id": entry.get('item_id'),
            "item_name": entry.get('item_name'),
            "from_location": "Warehouse",
            "to_location": None,
            "status": entry['status'],
            "created_at": entry['created_at'],
            "created_by": entry['created_by'],
            "place_of_supply": entry['place_of_supply'],
            "has_broker": entry['has_broker'],
            "broker_name": entry.get('broker_name'),
            "marka": entry.get('marka'),
            "bharti": entry.get('bharti'),
            "expected_weight": entry.get('expected_weight'),
            "tare_weight": entry.get('tare_weight', 0),
            "gross_weight": entry.get('gross_weight', 0),
            "net_weight": entry.get('net_weight', 0),
            "vehicle_number_from_tare": vehicle_number_from_tare  # Vehicle number from TARE entry
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
    Supports:
    - Single weighment (gross + tare together) for purchases
    - Tare → Gross flow (two separate entries) for sales
    """
    try:
        print(f"[WEIGHBRIDGE] Received entry request - Slip: {entry_data.slip_id}, Weight Type: {entry_data.weight_type}, Weight: {entry_data.weight if hasattr(entry_data, 'weight') else 'N/A'}")
        
        # Universal pre-entry lookup
        slip_id = entry_data.slip_id
        pre_entry = None
        collection_name = None
        is_bill_purchase = slip_id.startswith("BPRE-")
        is_sales = slip_id.startswith("SPRE-")
        
        if is_bill_purchase:
            pre_entry = await db.bill_purchase_pre_entries.find_one({"pre_entry_number": slip_id})
            collection_name = "bill_purchase_pre_entries"
            transaction_type = TransactionType.BILL_PURCHASE
        elif is_sales:
            pre_entry = await db.sales_pre_entries.find_one({"pre_entry_number": slip_id})
            collection_name = "sales_pre_entries"
            transaction_type = TransactionType.SALE
        else:
            pre_entry = await db.pre_entries.find_one({"slip_id": slip_id})
            collection_name = "pre_entries"
            transaction_type = TransactionType(pre_entry['transaction_type']) if pre_entry else None
        
        if not pre_entry:
            raise HTTPException(status_code=404, detail="Pre-entry not found. Invalid slip ID.")
        
        # For single type (purchases): Check if already weighed
        if entry_data.weight_type == "single":
            existing = await db.weighbridge_entries.find_one({"slip_id": entry_data.slip_id})
            if existing:
                raise HTTPException(status_code=400, detail="Slip already weighed")
        
        # For tare/gross type (sales): Check for duplicates of same type
        if entry_data.weight_type in ["tare", "gross"]:
            existing_same_type = await db.weighbridge_entries.find_one({
                "slip_id": entry_data.slip_id,
                "weight_type": entry_data.weight_type
            })
            print(f"[WEIGHBRIDGE DEBUG] Checking for duplicate {entry_data.weight_type} - Slip: {entry_data.slip_id}, Found existing: {existing_same_type is not None}")
            if existing_same_type:
                print(f"[WEIGHBRIDGE ERROR] Duplicate {entry_data.weight_type} weight attempt for {entry_data.slip_id}, Existing ID: {existing_same_type.get('id')}")
                raise HTTPException(status_code=400, detail=f"{entry_data.weight_type.capitalize()} weight already captured for this slip")
        
        # Calculate weights based on type
        if entry_data.weight_type == "single":
            # Single weighment: both provided
            net_weight = entry_data.gross_weight - entry_data.tare_weight
            if net_weight <= 0:
                raise HTTPException(status_code=400, detail="Gross weight must be greater than tare weight")
            measured_weight = entry_data.gross_weight  # For logging
        elif entry_data.weight_type == "tare":
            # Tare only
            measured_weight = entry_data.weight
            net_weight = 0  # Will be calculated when gross is captured
        else:  # gross
            # Gross only
            measured_weight = entry_data.weight
            # Check if tare exists to calculate net
            tare_entry = await db.weighbridge_entries.find_one({
                "slip_id": entry_data.slip_id,
                "weight_type": "tare"
            })
            if tare_entry:
                net_weight = measured_weight - tare_entry['weight']
            else:
                net_weight = 0  # Tare not yet captured
        
        # Calculate quantities
        quantities = calculate_quantities(net_weight) if net_weight > 0 else {"bags": 0, "rem_kg": 0, "act_qtl": 0.0}
        
        # Mock photo URL - Use data URI instead of external service
        # Simple 1x1 gray placeholder that works offline
        mock_photo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23e0e0e0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='32' fill='%23666'%3E" + entry_data.weight_type.capitalize() + " Weight Photo%3C/text%3E%3C/svg%3E"
        
        # Build weighbridge entry
        wb_entry = WeighbridgeEntry(
            pre_entry_id=pre_entry['id'],
            slip_id=entry_data.slip_id,
            transaction_type=transaction_type,
            weight_type=entry_data.weight_type,
            vehicle_number=entry_data.vehicle_number,
            vehicle_type=entry_data.vehicle_type,
            driver_name=entry_data.driver_name,
            driver_mobile=entry_data.driver_mobile,
            gross_weight=entry_data.gross_weight if entry_data.weight_type == "single" else (measured_weight if entry_data.weight_type == "gross" else 0),
            tare_weight=entry_data.tare_weight if entry_data.weight_type == "single" else (measured_weight if entry_data.weight_type == "tare" else 0),
            net_weight=net_weight,
            weight=measured_weight,
            bags=quantities['bags'],
            rem_kg=quantities['rem_kg'],
            act_qtl=quantities['act_qtl'],
            photo_url=mock_photo if entry_data.weight_type != "single" else None,
            photo_timestamp=datetime.now(timezone.utc) if entry_data.weight_type != "single" else None,
            photo_gross_url=mock_photo if entry_data.weight_type == "single" else None,
            photo_tare_url=mock_photo if entry_data.weight_type == "single" else None,
            photo_gross_timestamp=datetime.now(timezone.utc) if entry_data.weight_type == "single" else None,
            photo_tare_timestamp=datetime.now(timezone.utc) if entry_data.weight_type == "single" else None,
            operator_id=entry_data.operator_id,
            operator_name=entry_data.operator_name,
            shift=entry_data.shift
        )
        
        # Save to database
        doc = wb_entry.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['weighed_at'] = doc['weighed_at'].isoformat()
        if doc.get('photo_timestamp'):
            doc['photo_timestamp'] = doc['photo_timestamp'].isoformat()
        if doc.get('photo_gross_timestamp'):
            doc['photo_gross_timestamp'] = doc['photo_gross_timestamp'].isoformat()
        if doc.get('photo_tare_timestamp'):
            doc['photo_tare_timestamp'] = doc['photo_tare_timestamp'].isoformat()
        doc['transaction_type'] = doc['transaction_type'].value
        doc['status'] = doc['status'].value
        doc['photo_upload_status'] = doc['photo_upload_status'].value
        
        try:
            result = await db.weighbridge_entries.insert_one(doc)
            print(f"[BACKEND] Created {entry_data.weight_type} weighbridge entry for {slip_id}, weight: {measured_weight} kg, DB ID: {result.inserted_id}")
        except Exception as insert_error:
            print(f"[BACKEND ERROR] Failed to insert weighbridge entry: {insert_error}")
            import traceback
            print(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Failed to save weighbridge entry: {str(insert_error)}")
        
        # Update pre-entry status based on type
        if entry_data.weight_type == "tare":
            # TARE weighment
            if is_sales:
                # Sales: TARE first, then GROSS
                update_data = {
                    "tare_weight": measured_weight,
                    "status": "tare_completed",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await getattr(db, collection_name).update_one(
                    {"id": pre_entry['id']},
                    {"$set": update_data}
                )
                print(f"[BACKEND] Updated sales pre-entry status to tare_completed, tare_weight: {measured_weight} kg")
            elif is_bill_purchase or not is_sales:
                # Bill Purchase / Farmer Purchase: GROSS first, then TARE
                # Check if GROSS already exists to calculate net weight
                gross_entry = await db.weighbridge_entries.find_one({
                    "slip_id": entry_data.slip_id,
                    "weight_type": "gross"
                })
                if gross_entry:
                    # Both weights captured, mark as complete
                    calc_net_weight = gross_entry['weight'] - measured_weight
                    update_data = {
                        "tare_weight": measured_weight,
                        "net_weight": calc_net_weight,
                        "weighbridge_completed": True,
                        "status": "pending" if is_bill_purchase else "weighed",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    print(f"[BACKEND] Bill/Farmer purchase complete - TARE: {measured_weight} kg, NET: {calc_net_weight} kg, Status: {'pending (ready for bill)' if is_bill_purchase else 'weighed'}")
                else:
                    # Just TARE, no GROSS yet (shouldn't happen for purchase flow)
                    update_data = {
                        "tare_weight": measured_weight,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    print(f"[BACKEND] Updated pre-entry with tare_weight: {measured_weight} kg")
                
                await getattr(db, collection_name).update_one(
                    {"id": pre_entry['id']},
                    {"$set": update_data}
                )
        
        elif entry_data.weight_type == "gross" and net_weight == 0:
            # GROSS weight captured, but TARE not yet captured
            update_data = {
                "gross_weight": measured_weight,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Update status for purchase flows (both bill and farmer)
            if is_bill_purchase or not is_sales:
                update_data["status"] = "gross_completed"
            
            await getattr(db, collection_name).update_one(
                {"id": pre_entry['id']},
                {"$set": update_data}
            )
            print(f"[BACKEND] Updated pre-entry with gross_weight: {measured_weight} kg, status: gross_completed, waiting for TARE")
        
        elif entry_data.weight_type == "single" or (entry_data.weight_type == "gross" and net_weight > 0):
            # Mark as completed (both weights captured)
            update_data = {
                "weighbridge_completed": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if is_sales:
                # Update sales pre-entry with weights and status to pending (ready for invoice)
                update_data["tare_weight"] = tare_entry['weight'] if entry_data.weight_type == "gross" else measured_weight
                update_data["gross_weight"] = measured_weight if entry_data.weight_type == "gross" else 0
                update_data["net_weight"] = net_weight
                update_data["status"] = "pending"
                print(f"[BACKEND] Updated sales pre-entry to PENDING (ready for invoice), net_weight: {net_weight} kg")
            elif is_bill_purchase:
                # Bill purchase: Update all weights
                update_data["gross_weight"] = measured_weight if entry_data.weight_type == "gross" else entry_data.gross_weight
                update_data["tare_weight"] = tare_entry['weight'] if entry_data.weight_type == "gross" else entry_data.tare_weight
                update_data["net_weight"] = net_weight
                update_data["status"] = "pending"
                print(f"[BACKEND] Updated bill purchase pre-entry to PENDING (ready for bill creation), net_weight: {net_weight} kg")
            else:
                # Farmer purchase
                update_data["gross_weight"] = measured_weight if entry_data.weight_type == "gross" else entry_data.gross_weight
                update_data["tare_weight"] = tare_entry['weight'] if entry_data.weight_type == "gross" else entry_data.tare_weight
                update_data["net_weight"] = net_weight
                update_data["status"] = PreEntryStatus.WEIGHED.value
                print(f"[BACKEND] Updated farmer purchase pre-entry to WEIGHED, net_weight: {net_weight} kg")
            
            await getattr(db, collection_name).update_one(
                {"id": pre_entry['id']},
                {"$set": update_data}
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
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BACKEND ERROR] Weighbridge entry creation failed: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/weighbridge-entry/by-slip/{slip_id}")
async def get_weighbridge_entry_by_slip(slip_id: str):
    """
    Fetch complete weighbridge data by slip ID.
    For sales (SPRE-), combines TARE and GROSS entries.
    For other types, returns single entry.
    """
    is_sales = slip_id.startswith("SPRE-")
    
    if is_sales:
        # Fetch both TARE and GROSS entries for sales
        tare_entry = await db.weighbridge_entries.find_one(
            {"slip_id": slip_id, "weight_type": "tare"}, 
            {"_id": 0}
        )
        gross_entry = await db.weighbridge_entries.find_one(
            {"slip_id": slip_id, "weight_type": "gross"}, 
            {"_id": 0}
        )
        
        if not tare_entry and not gross_entry:
            raise HTTPException(status_code=404, detail="Weighbridge entries not found")
        
        # Combine data
        return {
            "slip_id": slip_id,
            "transaction_type": "sale",
            "tare_weight": tare_entry['weight'] if tare_entry else 0,
            "gross_weight": gross_entry['weight'] if gross_entry else 0,
            "net_weight": (gross_entry['weight'] if gross_entry else 0) - (tare_entry['weight'] if tare_entry else 0),
            "photo_tare_url": tare_entry.get('photo_url') if tare_entry else None,
            "photo_gross_url": gross_entry.get('photo_url') if gross_entry else None,
            "tare_timestamp": tare_entry.get('weighed_at') if tare_entry else None,
            "gross_timestamp": gross_entry.get('weighed_at') if gross_entry else None,
            "vehicle_number": gross_entry.get('vehicle_number') if gross_entry else tare_entry.get('vehicle_number') if tare_entry else None
        }
    else:
        # Regular single weighment
        wb_entry = await db.weighbridge_entries.find_one({"slip_id": slip_id}, {"_id": 0})
        
        if not wb_entry:
            raise HTTPException(status_code=404, detail="Weighbridge entry not found")
        
        return {
            "slip_id": slip_id,
            "transaction_type": wb_entry.get('transaction_type'),
            "tare_weight": wb_entry.get('tare_weight', 0),
            "gross_weight": wb_entry.get('gross_weight', 0),
            "net_weight": wb_entry.get('net_weight', 0),
            "photo_tare_url": wb_entry.get('photo_tare_url'),
            "photo_gross_url": wb_entry.get('photo_gross_url'),
            "vehicle_number": wb_entry.get('vehicle_number')
        }

@router.get("/weighbridge-entry/{slip_id}")
async def get_weighbridge_entry(slip_id: str):
    """
    Fetch weighbridge entry by slip ID.
    Used by downstream modules (Farmer Payment, Bill Purchase, etc.)
    Returns consolidated weight data from pre-entry.
    """
    # Fetch weighbridge entries (may have multiple: GROSS and TARE)
    wb_entries = await db.weighbridge_entries.find({"slip_id": slip_id}, {"_id": 0}).to_list(10)
    
    if not wb_entries:
        raise HTTPException(status_code=404, detail="Weighbridge entry not found")
    
    # Get the first entry for basic details
    wb_entry = wb_entries[0]
    
    # Fetch linked pre-entry (check both collections)
    pre_entry = None
    if slip_id.startswith("BPRE-"):
        pre_entry = await db.bill_purchase_pre_entries.find_one({"pre_entry_number": slip_id}, {"_id": 0})
        if pre_entry:
            # Get weights from pre-entry (updated after weighbridge completion)
            net_weight = pre_entry.get('net_weight', 0) or 0
            gross_weight = pre_entry.get('gross_weight', 0) or 0
            tare_weight = pre_entry.get('tare_weight', 0) or 0
            
            # Convert to universal format with calculated weights
            pre_entry = {
                "party_name": pre_entry['supplier_name'],
                "party_mobile": None,
                "party_gstin": pre_entry.get('supplier_gstin'),
                "transaction_type": "bill_purchase",
                "eway_bill_no": pre_entry.get('eway_bill_no'),
                "place_of_supply": pre_entry['place_of_supply'],
                "gross_weight": gross_weight,
                "tare_weight": tare_weight,
                "net_weight": net_weight,
                "bags": int(net_weight / 100) if net_weight > 0 else 0,
                "act_qtl": round(net_weight / 100, 2) if net_weight > 0 else 0
            }
    else:
        # Farmer purchase (WB-)
        pre_entry = await db.pre_entries.find_one({"slip_id": slip_id}, {"_id": 0})
        if pre_entry:
            # Get weights from pre-entry (updated after weighbridge completion)
            net_weight = pre_entry.get('net_weight', 0) or 0
            gross_weight = pre_entry.get('gross_weight', 0) or 0
            tare_weight = pre_entry.get('tare_weight', 0) or 0
            
            # Calculate bags and quintals
            bags = int(net_weight / 100) if net_weight > 0 else 0
            act_qtl = round(net_weight / 100, 2) if net_weight > 0 else 0
            
            # Add calculated fields to pre_entry
            pre_entry['gross_weight'] = gross_weight
            pre_entry['tare_weight'] = tare_weight
            pre_entry['net_weight'] = net_weight
            pre_entry['bags'] = bags
            pre_entry['act_qtl'] = act_qtl
    
    # Combine data for auto-fill
    combined = {
        **wb_entry,
        "slip_id": slip_id,
        "party_name": pre_entry.get('party_name') if pre_entry else None,
        "party_mobile": pre_entry.get('party_mobile') if pre_entry else None,
        "item_id": pre_entry.get('item_id') if pre_entry else None,
        "item_name": pre_entry.get('item_name') if pre_entry else None,
        "quality": pre_entry.get('quality') if pre_entry else None,
        "rate_per_qtl": pre_entry.get('rate_per_qtl') if pre_entry else None,
        "from_location": pre_entry.get('from_location') if pre_entry else None,
        "to_location": pre_entry.get('to_location') if pre_entry else None,
        "gross_weight": pre_entry.get('gross_weight', 0) if pre_entry else 0,
        "tare_weight": pre_entry.get('tare_weight', 0) if pre_entry else 0,
        "net_weight": pre_entry.get('net_weight', 0) if pre_entry else 0,
        "bags": pre_entry.get('bags', 0) if pre_entry else 0,
        "act_qtl": pre_entry.get('act_qtl', 0) if pre_entry else 0,
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



# ============= UNIVERSAL WEIGHBRIDGE QUEUE =============

@router.get("/weighbridge/queue", response_model=WeighbridgeQueueResponse)
async def get_weighbridge_queue(
    transaction_type: Optional[str] = None,
    status: Optional[str] = None
):
    """
    Universal weighbridge queue - shows all pending pre-entries from all transaction types.
    Includes smart action buttons (TARE/GROSS) based on current status.
    
    Query params:
    - transaction_type: Filter by 'farmer_purchase', 'bill_purchase', or 'sale'
    - status: Filter by status ('pending', 'tare_completed', etc.)
    """
    try:
        queue_items = []
        
        # ===== 1. Fetch Farmer Purchase Pre-Entries (WB-) =====
        wb_filter = {"status": {"$nin": ["weighed", "paid"]}}
        if status:
            wb_filter["status"] = status
        
        if not transaction_type or transaction_type == 'farmer_purchase':
            wb_entries = await db.pre_entries.find(wb_filter, {"_id": 0}).to_list(1000)
            
            for entry in wb_entries:
                # Determine next action based on status
                tare_pending = False
                gross_pending = False
                next_action = 'gross'  # Default for farmer purchase
                
                if entry['status'] == 'pending':
                    # No weights captured yet - need GROSS first for purchase
                    gross_pending = True
                    next_action = 'gross'
                elif entry['status'] == 'gross_completed':
                    # GROSS done, need TARE
                    tare_pending = True
                    next_action = 'tare'
                elif entry['status'] == 'weighed':
                    # Both done
                    next_action = 'complete'
                
                queue_item = WeighbridgeQueueItem(
                    pre_entry_id=entry['id'],
                    slip_id=entry['slip_id'],
                    pre_entry_number=entry['slip_id'],  # Same as slip_id for WB
                    transaction_type='farmer_purchase',
                    party_name=entry.get('party_name', 'Unknown'),
                    party_mobile=entry.get('farmer_mobile'),
                    item_name=entry.get('item_name'),
                    item_id=entry.get('item_id'),
                    tare_weight=entry.get('tare_weight'),
                    gross_weight=entry.get('gross_weight'),
                    net_weight=entry.get('net_weight'),
                    vehicle_number=entry.get('vehicle_number'),
                    vehicle_type=entry.get('vehicle_type'),
                    status=entry['status'],
                    tare_pending=tare_pending,
                    gross_pending=gross_pending,
                    next_action=next_action,
                    created_at=datetime.fromisoformat(entry['created_at']) if isinstance(entry['created_at'], str) else entry['created_at'],
                    date=entry.get('date', '')
                )
                queue_items.append(queue_item)
        
        # ===== 2. Fetch Bill Purchase Pre-Entries (BPRE-) =====
        if not transaction_type or transaction_type == 'bill_purchase':
            bp_filter = {"weighbridge_completed": False}
            bp_entries = await db.bill_purchase_pre_entries.find(bp_filter, {"_id": 0}).to_list(1000)
            
            for entry in bp_entries:
                # Determine next action
                tare_pending = False
                gross_pending = False
                next_action = 'gross'
                
                tare_wt = entry.get('tare_weight', 0) or 0
                gross_wt = entry.get('gross_weight', 0) or 0
                
                if gross_wt == 0:
                    # Need GROSS first
                    gross_pending = True
                    next_action = 'gross'
                elif tare_wt == 0:
                    # GROSS done, need TARE
                    tare_pending = True
                    next_action = 'tare'
                else:
                    # Both done
                    next_action = 'complete'
                
                queue_item = WeighbridgeQueueItem(
                    pre_entry_id=entry['id'],
                    slip_id=entry['pre_entry_number'],
                    pre_entry_number=entry['pre_entry_number'],
                    transaction_type='bill_purchase',
                    party_name=entry.get('supplier_name', 'Unknown'),
                    party_mobile=None,
                    item_name=entry.get('item_name'),
                    item_id=entry.get('item_id'),
                    tare_weight=entry.get('tare_weight'),
                    gross_weight=entry.get('gross_weight'),
                    net_weight=entry.get('net_weight'),
                    vehicle_number=entry.get('vehicle_number'),
                    vehicle_type=None,
                    status=entry.get('status', 'pending'),
                    tare_pending=tare_pending,
                    gross_pending=gross_pending,
                    next_action=next_action,
                    created_at=datetime.fromisoformat(entry['created_at']) if isinstance(entry['created_at'], str) else entry['created_at'],
                    date=entry.get('date', '')
                )
                queue_items.append(queue_item)
        
        # ===== 3. Fetch Sales Pre-Entries (SPRE-) =====
        if not transaction_type or transaction_type == 'sale':
            sales_filter = {"weighbridge_completed": False}
            if status:
                sales_filter["status"] = status
            
            sales_entries = await db.sales_pre_entries.find(sales_filter, {"_id": 0}).to_list(1000)
            
            for entry in sales_entries:
                # Determine next action
                tare_pending = False
                gross_pending = False
                next_action = 'tare'  # Sales starts with TARE
                
                tare_wt = entry.get('tare_weight', 0) or 0
                gross_wt = entry.get('gross_weight', 0) or 0
                
                if tare_wt == 0:
                    # Need TARE first for sales
                    tare_pending = True
                    next_action = 'tare'
                elif gross_wt == 0:
                    # TARE done, need GROSS
                    gross_pending = True
                    next_action = 'gross'
                else:
                    # Both done
                    next_action = 'complete'
                
                queue_item = WeighbridgeQueueItem(
                    pre_entry_id=entry['id'],
                    slip_id=entry['slip_id'],
                    pre_entry_number=entry['pre_entry_number'],
                    transaction_type='sale',
                    party_name=entry.get('customer_name', 'Unknown'),
                    party_mobile=None,
                    item_name=entry.get('item_name'),
                    item_id=entry.get('item_id'),
                    tare_weight=entry.get('tare_weight'),
                    gross_weight=entry.get('gross_weight'),
                    net_weight=entry.get('net_weight'),
                    vehicle_number=entry.get('vehicle_number_from_tare'),
                    vehicle_type=None,
                    status=entry.get('status', 'pending'),
                    tare_pending=tare_pending,
                    gross_pending=gross_pending,
                    next_action=next_action,
                    created_at=datetime.fromisoformat(entry['created_at']) if isinstance(entry['created_at'], str) else entry['created_at'],
                    date=entry.get('date', '')
                )
                queue_items.append(queue_item)
        
        # Sort by created_at (newest first)
        queue_items.sort(key=lambda x: x.created_at, reverse=True)
        
        return WeighbridgeQueueResponse(
            total=len(queue_items),
            queue=queue_items
        )
        
    except Exception as e:
        print(f"[BACKEND ERROR] Weighbridge queue fetch failed: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

