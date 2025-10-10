"""
Setup mock data for Farmer Payment testing
Creates items and weighbridge pre-entries matching the new schema
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone
import uuid

load_dotenv()
mongo_url = os.environ.get('MONGO_URL')

async def setup_mock_data():
    client = AsyncIOMotorClient(mongo_url)
    db = client.sudarshan_erp
    
    print("Setting up mock data for Farmer Payment module...")
    
    # Step 1: Delete old weighbridge data if exists
    print("\n1. Cleaning old data...")
    if 'weighbridge_entries' in await db.list_collection_names():
        result = await db.weighbridge_entries.delete_many({})
        print(f"   Deleted {result.deleted_count} old weighbridge entries")
    
    if 'weighbridge_pre_entries' in await db.list_collection_names():
        result = await db.weighbridge_pre_entries.delete_many({})
        print(f"   Deleted {result.deleted_count} weighbridge pre-entries")
    
    # Step 2: Create sample items
    print("\n2. Creating sample items...")
    items = [
        {
            "id": str(uuid.uuid4()),
            "name": "Wheat (गेहूं)",
            "category": "Grain",
            "unit": "Quintal",
            "current_price": 2500.00,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Soybean (सोयाबीन)",
            "category": "Grain",
            "unit": "Quintal",
            "current_price": 4500.00,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Chana (चना)",
            "category": "Pulse",
            "unit": "Quintal",
            "current_price": 5200.00,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Corn (मक्का)",
            "category": "Grain",
            "unit": "Quintal",
            "current_price": 1800.00,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Delete existing items and insert new ones
    await db.items.delete_many({})
    await db.items.insert_many(items)
    print(f"   Created {len(items)} items")
    for item in items:
        print(f"   - {item['name']}: ID={item['id']}, Price=₹{item['current_price']}")
    
    # Step 3: Create mock weighbridge pre-entries
    print("\n3. Creating mock weighbridge pre-entries...")
    
    # Mock photo URLs (using placeholder images)
    mock_photos = [
        [
            "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80",
            "https://images.unsplash.com/photo-1586528116493-a029325540fa?w=800&q=80"
        ],
        [
            "https://images.unsplash.com/photo-1580377968795-19c4c5d7e96f?w=800&q=80",
            "https://images.unsplash.com/photo-1580377968773-bbd84da59817?w=800&q=80"
        ]
    ]
    
    weighbridge_entries = []
    
    # Entry 1: Truck with Wheat
    net_weight_1 = 5234  # kg
    bags_1 = net_weight_1 // 100
    rem_kg_1 = net_weight_1 % 100
    act_qtl_1 = net_weight_1 / 100
    
    weighbridge_entries.append({
        "id": str(uuid.uuid4()),
        "slip_number": "WB000001",
        "gate_entry_no": "GT001",
        "farmer_name": "Ramesh Kumar",
        "mobile": "9876543210",
        "city": "Sanawad",
        "token_no": "TK123",
        "vehicle_number": "MP09AB1234",
        "vehicle_type": "Truck",
        "item_id": items[0]['id'],  # Wheat
        "item_name": items[0]['name'],
        "gross_weight": 25234.0,
        "tare_weight": 20000.0,
        "net_weight": net_weight_1,
        "bags": bags_1,
        "rem_kg": rem_kg_1,
        "act_qtl": act_qtl_1,
        "photo_gross_url": mock_photos[0][0],
        "photo_gross_timestamp": datetime.now(timezone.utc).isoformat(),
        "photo_tare_url": mock_photos[0][1],
        "photo_tare_timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "approved_by": None,
        "approved_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Entry 2: Tractor with Soybean
    net_weight_2 = 3567  # kg
    bags_2 = net_weight_2 // 100
    rem_kg_2 = net_weight_2 % 100
    act_qtl_2 = net_weight_2 / 100
    
    weighbridge_entries.append({
        "id": str(uuid.uuid4()),
        "slip_number": "WB000002",
        "gate_entry_no": "GT002",
        "farmer_name": "Suresh Patil",
        "mobile": "9988776655",
        "city": "Khargone",
        "token_no": "TK124",
        "vehicle_number": "MP09CD5678",
        "vehicle_type": "Tractor",
        "item_id": items[1]['id'],  # Soybean
        "item_name": items[1]['name'],
        "gross_weight": 13567.0,
        "tare_weight": 10000.0,
        "net_weight": net_weight_2,
        "bags": bags_2,
        "rem_kg": rem_kg_2,
        "act_qtl": act_qtl_2,
        "photo_gross_url": mock_photos[1][0],
        "photo_gross_timestamp": datetime.now(timezone.utc).isoformat(),
        "photo_tare_url": mock_photos[1][1],
        "photo_tare_timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "approved_by": None,
        "approved_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Entry 3: Hammali with Chana
    net_weight_3 = 2189  # kg
    bags_3 = net_weight_3 // 100
    rem_kg_3 = net_weight_3 % 100
    act_qtl_3 = net_weight_3 / 100
    
    weighbridge_entries.append({
        "id": str(uuid.uuid4()),
        "slip_number": "WB000003",
        "gate_entry_no": "GT003",
        "farmer_name": "Mahesh Jain",
        "mobile": "9123456789",
        "city": "Sanawad",
        "token_no": "TK125",
        "vehicle_number": "MP09EF9012",
        "vehicle_type": "Hammali",
        "item_id": items[2]['id'],  # Chana
        "item_name": items[2]['name'],
        "gross_weight": 12189.0,
        "tare_weight": 10000.0,
        "net_weight": net_weight_3,
        "bags": bags_3,
        "rem_kg": rem_kg_3,
        "act_qtl": act_qtl_3,
        "photo_gross_url": mock_photos[0][0],
        "photo_gross_timestamp": datetime.now(timezone.utc).isoformat(),
        "photo_tare_url": mock_photos[0][1],
        "photo_tare_timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "approved_by": None,
        "approved_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.weighbridge_pre_entries.insert_many(weighbridge_entries)
    print(f"   Created {len(weighbridge_entries)} weighbridge pre-entries")
    
    for entry in weighbridge_entries:
        print(f"\n   Entry: {entry['slip_number']} / {entry['gate_entry_no']}")
        print(f"     - Farmer: {entry['farmer_name']} ({entry['mobile']})")
        print(f"     - City: {entry['city']}, Token: {entry['token_no']}")
        print(f"     - Vehicle: {entry['vehicle_number']} ({entry['vehicle_type']})")
        print(f"     - Item: {entry['item_name']}")
        print(f"     - Weight: {entry['net_weight']} kg = {entry['bags']} bags + {entry['rem_kg']} kg = {entry['act_qtl']} qtl")
        print(f"     - Status: {entry['status']}")
    
    print("\n✅ Mock data setup completed successfully!")
    print("\nYou can now test the Farmer Payment module by:")
    print("1. Enter Gate Entry No: GT001, GT002, or GT003")
    print("2. Review the weighbridge photos")
    print("3. Approve and auto-fill the form")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_mock_data())
