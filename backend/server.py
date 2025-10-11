from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date, time
import qrcode
import io
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Import farmer payment endpoints and initialize with db
from farmer_payment_endpoints import router as farmer_payment_router, init_db as init_farmer_db
init_farmer_db(db)

# Import universal weighbridge endpoints and initialize with db
from universal_weighbridge_endpoints import router as universal_wb_router, init_db as init_universal_wb_db
init_universal_wb_db(db)

# Import OTP endpoints and initialize with db
from otp_endpoints import router as otp_router, init_db as init_otp_db
init_otp_db(db)

# Import bill purchase endpoints and initialize with db
from bill_purchase_endpoints import router as bill_purchase_router, init_db as init_bill_purchase_db
init_bill_purchase_db(db)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============= MODELS =============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password: str  # In production, hash this
    name: str
    role: str  # admin, manager, operator, accountant
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str

class Party(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    roles: List[str] = Field(default_factory=list)  # ["supplier", "trader", "buyer", "farmer"]
    
    # Contact details
    contact: Optional[str] = None  # Mobile number
    address: Optional[str] = None
    
    # Business details
    gstin: Optional[str] = None
    state: Optional[str] = None
    place_of_supply: Optional[str] = None  # Free text field
    pan: Optional[str] = None
    
    # Banking details (optional)
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class PartyCreate(BaseModel):
    name: str
    roles: List[str] = Field(default_factory=list)
    contact: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    state: Optional[str] = None
    place_of_supply: Optional[str] = None
    pan: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None

class Item(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str  # wheat, rice, corn, etc.
    unit: str  # kg, quintal, ton
    current_price: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ItemCreate(BaseModel):
    name: str
    category: str
    unit: str
    current_price: float

class WeighbridgeSlip(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slip_number: str
    qr_code: str  # Base64 encoded QR
    vehicle_number: str
    party_id: str
    party_name: str
    item_id: str
    item_name: str
    gross_weight: Optional[float] = None
    tare_weight: Optional[float] = None
    net_weight: Optional[float] = None
    status: str  # pre_entry, weighed, completed
    flow_type: str  # purchase, sale, custody, transfer
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class WeighbridgeSlipCreate(BaseModel):
    vehicle_number: str
    party_id: str
    item_id: str
    flow_type: str
    created_by: str

class WeighbridgeSlipUpdate(BaseModel):
    gross_weight: Optional[float] = None
    tare_weight: Optional[float] = None

class CustodyLot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lot_number: str
    weighbridge_slip_id: str
    party_id: str
    party_name: str
    item_id: str
    item_name: str
    quantity: float  # net weight
    rate: float  # per unit
    total_value: float
    pledged: bool = False
    pledge_amount: float = 0.0
    pledge_percentage: float = 0.0  # Max 70%
    current_ltv: float = 0.0  # Loan to Value ratio
    status: str  # active, settled, margin_call
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustodyLotCreate(BaseModel):
    weighbridge_slip_id: str
    party_id: str
    item_id: str
    quantity: float
    rate: float

class PledgeRequest(BaseModel):
    custody_lot_id: str
    pledge_percentage: float  # Max 70

class Purchase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    purchase_type: str  # farmer, bill
    party_id: str
    party_name: str
    weighbridge_slip_id: Optional[str] = None
    item_id: str
    item_name: str
    quantity: float
    rate: float
    total_amount: float
    payment_mode: Optional[str] = None  # cash, rtgs, cheque
    payment_reference: Optional[str] = None
    e_permit: Optional[str] = None  # E-Anugya number
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class PurchaseCreate(BaseModel):
    purchase_type: str
    party_id: str
    weighbridge_slip_id: Optional[str] = None
    item_id: str
    quantity: float
    rate: float
    payment_mode: Optional[str] = None
    payment_reference: Optional[str] = None
    e_permit: Optional[str] = None
    created_by: str

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    party_id: str
    party_name: str
    item_id: str
    item_name: str
    quantity: float
    rate: float
    total_amount: float
    gst_amount: float
    tcs_amount: float
    freight: float
    grand_total: float
    status: str  # pending, invoiced, paid
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class SaleCreate(BaseModel):
    party_id: str
    item_id: str
    quantity: float
    rate: float
    gst_percentage: float
    tcs_percentage: float
    freight: float
    created_by: str

class ProductionBatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    batch_number: str
    raw_item_id: str
    raw_item_name: str
    raw_quantity: float
    processed_item_id: str
    processed_item_name: str
    processed_quantity: float
    yield_percentage: float
    status: str  # in_progress, completed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class ProductionBatchCreate(BaseModel):
    raw_item_id: str
    raw_quantity: float
    processed_item_id: str

class ProductionBatchComplete(BaseModel):
    batch_id: str
    processed_quantity: float

class LedgerEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    entry_type: str  # journal, receipt, payment, contra
    party_id: Optional[str] = None
    description: str
    debit_amount: float = 0.0
    credit_amount: float = 0.0
    reference_type: Optional[str] = None  # purchase, sale, custody
    reference_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class LedgerEntryCreate(BaseModel):
    entry_type: str
    party_id: Optional[str] = None
    description: str
    debit_amount: float = 0.0
    credit_amount: float = 0.0
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    created_by: str

class DashboardStats(BaseModel):
    total_custody_lots: int
    active_pledges: int
    margin_calls: int
    pending_invoices: int
    pending_payments: int
    total_inventory_value: float

class MarginCallAlert(BaseModel):
    custody_lot_id: str
    lot_number: str
    party_name: str
    item_name: str
    current_ltv: float
    alert_level: str  # warning, critical
    ai_recommendation: str

# ============= HELPER FUNCTIONS =============

def generate_qr_code(data: str) -> str:
    """Generate QR code and return as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

async def calculate_ltv(custody_lot_id: str) -> float:
    """Calculate current LTV ratio"""
    lot = await db.custody_lots.find_one({"id": custody_lot_id})
    if not lot or lot['pledge_amount'] == 0:
        return 0.0
    
    # Get current item price
    item = await db.items.find_one({"id": lot['item_id']})
    if not item:
        return 0.0
    
    current_value = lot['quantity'] * item['current_price']
    ltv = (lot['pledge_amount'] / current_value) * 100
    return ltv

async def get_ai_margin_recommendation(lot_data: dict) -> str:
    """Get AI recommendation for margin call"""
    try:
        llm_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"margin_call_{lot_data['id']}",
            system_message="You are a financial advisor for agricultural commodity trading. Provide concise, actionable recommendations for margin calls."
        ).with_model("gemini", "gemini-2.5-pro")
        
        prompt = f"""
        Analyze this custody lot and provide a brief recommendation:
        
        Lot: {lot_data['lot_number']}
        Party: {lot_data['party_name']}
        Item: {lot_data['item_name']}
        Quantity: {lot_data['quantity']} units
        Current LTV: {lot_data['current_ltv']:.2f}%
        Pledged Amount: ₹{lot_data['pledge_amount']:,.2f}
        
        Provide a 2-3 sentence recommendation on whether to:
        1. Request immediate margin payment
        2. Allow grace period
        3. Consider liquidation
        """
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        return response
    except Exception as e:
        return f"Unable to generate AI recommendation: {str(e)}"

# ============= AUTH ENDPOINTS =============

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(**user_data.model_dump())
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    return {"message": "User registered successfully", "user_id": user.id}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username})
    if not user or user['password'] != credentials.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "message": "Login successful",
        "user": {
            "id": user['id'],
            "username": user['username'],
            "name": user['name'],
            "role": user['role']
        }
    }

# ============= PARTY ENDPOINTS =============

@api_router.post("/parties", response_model=Party)
async def create_party(party_data: PartyCreate):
    party = Party(**party_data.model_dump())
    doc = party.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.parties.insert_one(doc)
    return party

@api_router.get("/parties", response_model=List[Party])
async def get_parties():
    parties = await db.parties.find({}, {"_id": 0}).to_list(1000)
    for p in parties:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
    return parties

@api_router.get("/parties/{party_id}", response_model=Party)
async def get_party(party_id: str):
    party = await db.parties.find_one({"id": party_id}, {"_id": 0})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    if isinstance(party.get('created_at'), str):
        party['created_at'] = datetime.fromisoformat(party['created_at'])
    return party

# ============= ITEM ENDPOINTS =============

@api_router.post("/items", response_model=Item)
async def create_item(item_data: ItemCreate):
    item = Item(**item_data.model_dump())
    doc = item.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.items.insert_one(doc)
    return item

@api_router.get("/items", response_model=List[Item])
async def get_items():
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    return items

@api_router.put("/items/{item_id}/price")
async def update_item_price(item_id: str, new_price: float):
    result = await db.items.update_one(
        {"id": item_id},
        {"$set": {"current_price": new_price}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Recalculate LTV for all custody lots with this item
    custody_lots = await db.custody_lots.find({"item_id": item_id, "status": "active"}).to_list(1000)
    for lot in custody_lots:
        ltv = await calculate_ltv(lot['id'])
        await db.custody_lots.update_one(
            {"id": lot['id']},
            {"$set": {"current_ltv": ltv}}
        )
    
    return {"message": "Price updated and LTV recalculated"}

# ============= OLD WEIGHBRIDGE ENDPOINTS (COMMENTED OUT - NOW USING farmer_payment_endpoints.py) =============
# These old endpoints have been replaced by the new farmer payment module
# The new endpoints are in farmer_payment_endpoints.py and use a different schema

# @api_router.post("/weighbridge/pre-entry", response_model=WeighbridgeSlip)
# async def create_weighbridge_pre_entry(slip_data: WeighbridgeSlipCreate):
#     # Get party and item details
#     party = await db.parties.find_one({"id": slip_data.party_id})
#     item = await db.items.find_one({"id": slip_data.item_id})
#     
#     if not party or not item:
#         raise HTTPException(status_code=404, detail="Party or Item not found")
#     
#     # Generate slip number
#     count = await db.weighbridge_slips.count_documents({})
#     slip_number = f"WB{count + 1:06d}"
#     
#     # Generate QR code with slip details
#     qr_data = f"SLIP:{slip_number}|VEHICLE:{slip_data.vehicle_number}|PARTY:{party['name']}|ITEM:{item['name']}"
#     qr_code = generate_qr_code(qr_data)
#     
#     slip = WeighbridgeSlip(
#         slip_number=slip_number,
#         qr_code=qr_code,
#         vehicle_number=slip_data.vehicle_number,
#         party_id=slip_data.party_id,
#         party_name=party['name'],
#         item_id=slip_data.item_id,
#         item_name=item['name'],
#         status="pre_entry",
#         flow_type=slip_data.flow_type,
#         created_by=slip_data.created_by
#     )
#     
#     doc = slip.model_dump()
#     doc['created_at'] = doc['created_at'].isoformat()
#     await db.weighbridge_slips.insert_one(doc)
#     
#     return slip
# 
# @api_router.get("/weighbridge/slip/{slip_number}", response_model=WeighbridgeSlip)
# async def get_weighbridge_slip(slip_number: str):
#     slip = await db.weighbridge_slips.find_one({"slip_number": slip_number}, {"_id": 0})
#     if not slip:
#         raise HTTPException(status_code=404, detail="Slip not found")
#     if isinstance(slip.get('created_at'), str):
#         slip['created_at'] = datetime.fromisoformat(slip['created_at'])
#     return slip
# 
# @api_router.put("/weighbridge/weigh/{slip_number}")
# async def update_weighbridge_weights(slip_number: str, weights: WeighbridgeSlipUpdate):
#     slip = await db.weighbridge_slips.find_one({"slip_number": slip_number})
#     if not slip:
#         raise HTTPException(status_code=404, detail="Slip not found")
#     
#     update_data = {}
#     if weights.gross_weight is not None:
#         update_data['gross_weight'] = weights.gross_weight
#     if weights.tare_weight is not None:
#         update_data['tare_weight'] = weights.tare_weight
#     
#     # Calculate net weight if both available
#     if slip.get('gross_weight') and slip.get('tare_weight'):
#         update_data['net_weight'] = slip['gross_weight'] - slip['tare_weight']
#         update_data['status'] = 'weighed'
#     elif weights.gross_weight and weights.tare_weight:
#         update_data['net_weight'] = weights.gross_weight - weights.tare_weight
#         update_data['status'] = 'weighed'
#     
#     await db.weighbridge_slips.update_one(
#         {"slip_number": slip_number},
#         {"$set": update_data}
#     )
#     
#     return {"message": "Weights updated successfully"}
# 
# @api_router.get("/weighbridge/slips", response_model=List[WeighbridgeSlip])
# async def get_weighbridge_slips():
#     slips = await db.weighbridge_slips.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
#     for slip in slips:
#         if isinstance(slip.get('created_at'), str):
#             slip['created_at'] = datetime.fromisoformat(slip['created_at'])
#     return slips

# ============= CUSTODY & PLEDGE ENDPOINTS =============

@api_router.post("/custody/create", response_model=CustodyLot)
async def create_custody_lot(lot_data: CustodyLotCreate):
    # Get weighbridge slip
    slip = await db.weighbridge_slips.find_one({"id": lot_data.weighbridge_slip_id})
    if not slip or slip['status'] != 'weighed':
        raise HTTPException(status_code=400, detail="Invalid or incomplete weighbridge slip")
    
    # Get party and item details
    party = await db.parties.find_one({"id": lot_data.party_id})
    item = await db.items.find_one({"id": lot_data.item_id})
    
    if not party or not item:
        raise HTTPException(status_code=404, detail="Party or Item not found")
    
    # Generate lot number
    count = await db.custody_lots.count_documents({})
    lot_number = f"LOT{count + 1:06d}"
    
    total_value = lot_data.quantity * lot_data.rate
    
    lot = CustodyLot(
        lot_number=lot_number,
        weighbridge_slip_id=lot_data.weighbridge_slip_id,
        party_id=lot_data.party_id,
        party_name=party['name'],
        item_id=lot_data.item_id,
        item_name=item['name'],
        quantity=lot_data.quantity,
        rate=lot_data.rate,
        total_value=total_value,
        status="active"
    )
    
    doc = lot.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.custody_lots.insert_one(doc)
    
    # Mark weighbridge slip as completed
    await db.weighbridge_slips.update_one(
        {"id": lot_data.weighbridge_slip_id},
        {"$set": {"status": "completed"}}
    )
    
    return lot

@api_router.post("/custody/pledge")
async def pledge_custody_lot(pledge_data: PledgeRequest):
    if pledge_data.pledge_percentage > 70:
        raise HTTPException(status_code=400, detail="Maximum pledge percentage is 70%")
    
    lot = await db.custody_lots.find_one({"id": pledge_data.custody_lot_id})
    if not lot:
        raise HTTPException(status_code=404, detail="Custody lot not found")
    
    pledge_amount = (pledge_data.pledge_percentage / 100) * lot['total_value']
    ltv = pledge_data.pledge_percentage
    
    await db.custody_lots.update_one(
        {"id": pledge_data.custody_lot_id},
        {"$set": {
            "pledged": True,
            "pledge_amount": pledge_amount,
            "pledge_percentage": pledge_data.pledge_percentage,
            "current_ltv": ltv
        }}
    )
    
    return {
        "message": "Custody lot pledged successfully",
        "pledge_amount": pledge_amount
    }

@api_router.get("/custody/lots", response_model=List[CustodyLot])
async def get_custody_lots():
    lots = await db.custody_lots.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for lot in lots:
        if isinstance(lot.get('created_at'), str):
            lot['created_at'] = datetime.fromisoformat(lot['created_at'])
    return lots

@api_router.get("/custody/margin-calls", response_model=List[MarginCallAlert])
async def get_margin_calls():
    # Get all active pledged lots
    lots = await db.custody_lots.find({"pledged": True, "status": "active"}).to_list(1000)
    
    margin_calls = []
    for lot in lots:
        # Recalculate LTV
        ltv = await calculate_ltv(lot['id'])
        await db.custody_lots.update_one(
            {"id": lot['id']},
            {"$set": {"current_ltv": ltv}}
        )
        
        # Check if margin call needed (75-80% threshold)
        if ltv >= 75:
            alert_level = "critical" if ltv >= 80 else "warning"
            
            # Get AI recommendation
            lot['current_ltv'] = ltv
            ai_recommendation = await get_ai_margin_recommendation(lot)
            
            margin_calls.append(MarginCallAlert(
                custody_lot_id=lot['id'],
                lot_number=lot['lot_number'],
                party_name=lot['party_name'],
                item_name=lot['item_name'],
                current_ltv=ltv,
                alert_level=alert_level,
                ai_recommendation=ai_recommendation
            ))
    
    return margin_calls

# ============= PURCHASE ENDPOINTS =============

@api_router.post("/purchases", response_model=Purchase)
async def create_purchase(purchase_data: PurchaseCreate):
    # Get party and item details
    party = await db.parties.find_one({"id": purchase_data.party_id})
    item = await db.items.find_one({"id": purchase_data.item_id})
    
    if not party or not item:
        raise HTTPException(status_code=404, detail="Party or Item not found")
    
    total_amount = purchase_data.quantity * purchase_data.rate
    
    purchase = Purchase(
        purchase_type=purchase_data.purchase_type,
        party_id=purchase_data.party_id,
        party_name=party['name'],
        weighbridge_slip_id=purchase_data.weighbridge_slip_id,
        item_id=purchase_data.item_id,
        item_name=item['name'],
        quantity=purchase_data.quantity,
        rate=purchase_data.rate,
        total_amount=total_amount,
        payment_mode=purchase_data.payment_mode,
        payment_reference=purchase_data.payment_reference,
        e_permit=purchase_data.e_permit,
        created_by=purchase_data.created_by
    )
    
    doc = purchase.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.purchases.insert_one(doc)
    
    return purchase

@api_router.get("/purchases", response_model=List[Purchase])
async def get_purchases():
    purchases = await db.purchases.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for p in purchases:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
    return purchases

# ============= SALES ENDPOINTS =============

@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate):
    # Get party and item details
    party = await db.parties.find_one({"id": sale_data.party_id})
    item = await db.items.find_one({"id": sale_data.item_id})
    
    if not party or not item:
        raise HTTPException(status_code=404, detail="Party or Item not found")
    
    # Generate invoice number
    count = await db.sales.count_documents({})
    invoice_number = f"INV{count + 1:06d}"
    
    total_amount = sale_data.quantity * sale_data.rate
    gst_amount = (sale_data.gst_percentage / 100) * total_amount
    tcs_amount = (sale_data.tcs_percentage / 100) * total_amount
    grand_total = total_amount + gst_amount + tcs_amount + sale_data.freight
    
    sale = Sale(
        invoice_number=invoice_number,
        party_id=sale_data.party_id,
        party_name=party['name'],
        item_id=sale_data.item_id,
        item_name=item['name'],
        quantity=sale_data.quantity,
        rate=sale_data.rate,
        total_amount=total_amount,
        gst_amount=gst_amount,
        tcs_amount=tcs_amount,
        freight=sale_data.freight,
        grand_total=grand_total,
        status="pending",
        created_by=sale_data.created_by
    )
    
    doc = sale.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.sales.insert_one(doc)
    
    return sale

@api_router.get("/sales", response_model=List[Sale])
async def get_sales():
    sales = await db.sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for s in sales:
        if isinstance(s.get('created_at'), str):
            s['created_at'] = datetime.fromisoformat(s['created_at'])
    return sales

# ============= PRODUCTION ENDPOINTS =============

@api_router.post("/production/batch", response_model=ProductionBatch)
async def create_production_batch(batch_data: ProductionBatchCreate):
    # Get item details
    raw_item = await db.items.find_one({"id": batch_data.raw_item_id})
    processed_item = await db.items.find_one({"id": batch_data.processed_item_id})
    
    if not raw_item or not processed_item:
        raise HTTPException(status_code=404, detail="Items not found")
    
    # Generate batch number
    count = await db.production_batches.count_documents({})
    batch_number = f"BATCH{count + 1:06d}"
    
    batch = ProductionBatch(
        batch_number=batch_number,
        raw_item_id=batch_data.raw_item_id,
        raw_item_name=raw_item['name'],
        raw_quantity=batch_data.raw_quantity,
        processed_item_id=batch_data.processed_item_id,
        processed_item_name=processed_item['name'],
        processed_quantity=0.0,
        yield_percentage=0.0,
        status="in_progress"
    )
    
    doc = batch.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.production_batches.insert_one(doc)
    
    return batch

@api_router.put("/production/complete")
async def complete_production_batch(completion: ProductionBatchComplete):
    batch = await db.production_batches.find_one({"id": completion.batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    yield_percentage = (completion.processed_quantity / batch['raw_quantity']) * 100
    
    await db.production_batches.update_one(
        {"id": completion.batch_id},
        {"$set": {
            "processed_quantity": completion.processed_quantity,
            "yield_percentage": yield_percentage,
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Batch completed",
        "yield_percentage": yield_percentage
    }

@api_router.get("/production/batches", response_model=List[ProductionBatch])
async def get_production_batches():
    batches = await db.production_batches.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for b in batches:
        if isinstance(b.get('created_at'), str):
            b['created_at'] = datetime.fromisoformat(b['created_at'])
        if isinstance(b.get('completed_at'), str):
            b['completed_at'] = datetime.fromisoformat(b['completed_at'])
    return batches

# ============= LEDGER ENDPOINTS =============

@api_router.post("/ledger/entry", response_model=LedgerEntry)
async def create_ledger_entry(entry_data: LedgerEntryCreate):
    entry = LedgerEntry(**entry_data.model_dump())
    doc = entry.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.ledger_entries.insert_one(doc)
    return entry

@api_router.get("/ledger/entries", response_model=List[LedgerEntry])
async def get_ledger_entries():
    entries = await db.ledger_entries.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for e in entries:
        if isinstance(e.get('created_at'), str):
            e['created_at'] = datetime.fromisoformat(e['created_at'])
    return entries

# ============= DASHBOARD ENDPOINTS =============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats():
    total_custody = await db.custody_lots.count_documents({"status": "active"})
    active_pledges = await db.custody_lots.count_documents({"pledged": True, "status": "active"})
    
    # Count margin calls
    margin_count = 0
    lots = await db.custody_lots.find({"pledged": True, "status": "active"}).to_list(1000)
    for lot in lots:
        ltv = await calculate_ltv(lot['id'])
        if ltv >= 75:
            margin_count += 1
    
    pending_invoices = await db.sales.count_documents({"status": "pending"})
    
    # Calculate total inventory value
    custody_lots = await db.custody_lots.find({"status": "active"}).to_list(1000)
    total_value = sum(lot['total_value'] for lot in custody_lots)
    
    return DashboardStats(
        total_custody_lots=total_custody,
        active_pledges=active_pledges,
        margin_calls=margin_count,
        pending_invoices=pending_invoices,
        pending_payments=0,  # Can be calculated from ledger
        total_inventory_value=total_value
    )

# Include farmer payment router in api_router BEFORE adding to app
api_router.include_router(farmer_payment_router, tags=["farmer-payment"])

# Include universal weighbridge router
api_router.include_router(universal_wb_router, tags=["universal-weighbridge"])

# Include OTP router
api_router.include_router(otp_router, tags=["otp-verification"])

# Include bill purchase router
api_router.include_router(bill_purchase_router, tags=["bill-purchase"])

# Include routers in app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db():
    """Initialize database collections and indexes"""
    try:
        # Create indexes for bill purchase collections
        await db.bill_purchase_pre_entries.create_index("pre_entry_number", unique=True)
        await db.bill_purchase_pre_entries.create_index([("supplier_id", 1), ("eway_bill_no", 1)])
        await db.bill_purchase_pre_entries.create_index("status")
        await db.bill_purchase_pre_entries.create_index("created_at")
        
        await db.bill_purchases.create_index("pre_entry_id")
        await db.bill_purchases.create_index("supplier_id")
        await db.bill_purchases.create_index("status")
        await db.bill_purchases.create_index("created_at")
        
        # Ensure parties collection supports roles array
        await db.parties.create_index("roles")
        await db.parties.create_index("gstin")
        
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating database indexes: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
