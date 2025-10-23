#!/usr/bin/env python3
"""
Create test mixed load pre-entry data for testing the Mixed Load Invoice Processing feature
"""
import asyncio
import sys
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

# Add parent directory to path for imports
sys.path.append('/app/backend')

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'sudarshan_erp')

async def create_test_data():
    """Create test mixed load pre-entry with weighbridge data"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🚀 Creating Mixed Load Test Data...")
    
    # 1. Get existing customers
    customers = await db.parties.find({"role": "customer"}).limit(3).to_list(3)
    if len(customers) < 2:
        print("❌ Need at least 2 customers in database")
        return
    
    print(f"✅ Found {len(customers)} customers")
    
    # 2. Get existing items
    items = await db.items.find({}).limit(3).to_list(3)
    if len(items) < 2:
        print("❌ Need at least 2 items in database")
        return
    
    print(f"✅ Found {len(items)} items")
    
    # 3. Create mixed load pre-entry
    pre_entry_number = "SPRE-25-999999"  # Test number
    
    line_items = [
        {
            "line_id": str(uuid.uuid4()),
            "customer_id": customers[0]['id'],
            "customer_name": customers[0]['name'],
            "customer_gstin": customers[0].get('gstin'),
            "place_of_supply": customers[0].get('place_of_supply', 'Mumbai'),
            "item_id": items[0]['id'],
            "item_name": items[0]['name'],
            "marka": "Grade A Premium",
            "bharti": 50,
            "expected_bags": 400,
            "expected_weight": 20000.0,  # 20000 kg = 200 quintals
            "item_rate": 2500.0,
            "invoice_id": None,
            "actual_weight": None
        },
        {
            "line_id": str(uuid.uuid4()),
            "customer_id": customers[1]['id'] if len(customers) > 1 else customers[0]['id'],
            "customer_name": customers[1]['name'] if len(customers) > 1 else customers[0]['name'],
            "customer_gstin": customers[1].get('gstin') if len(customers) > 1 else customers[0].get('gstin'),
            "place_of_supply": customers[1].get('place_of_supply', 'Delhi') if len(customers) > 1 else 'Delhi',
            "item_id": items[1]['id'] if len(items) > 1 else items[0]['id'],
            "item_name": items[1]['name'] if len(items) > 1 else items[0]['name'],
            "marka": "Anchor",
            "bharti": 50,
            "expected_bags": 600,
            "expected_weight": 30000.0,  # 30000 kg = 300 quintals
            "item_rate": 2400.0,
            "invoice_id": None,
            "actual_weight": None
        }
    ]
    
    if len(customers) > 2 and len(items) > 2:
        line_items.append({
            "line_id": str(uuid.uuid4()),
            "customer_id": customers[2]['id'],
            "customer_name": customers[2]['name'],
            "customer_gstin": customers[2].get('gstin'),
            "place_of_supply": customers[2].get('place_of_supply', 'Pune'),
            "item_id": items[2]['id'],
            "item_name": items[2]['name'],
            "marka": "Special",
            "bharti": 50,
            "expected_bags": 200,
            "expected_weight": 10000.0,  # 10000 kg = 100 quintals
            "item_rate": 2600.0,
            "invoice_id": None,
            "actual_weight": None
        })
    
    total_expected = sum(item['expected_weight'] for item in line_items)
    
    pre_entry_doc = {
        "id": str(uuid.uuid4()),
        "pre_entry_number": pre_entry_number,
        "slip_id": pre_entry_number,
        "qr_code": f"SALE|{pre_entry_number}|{datetime.now(timezone.utc).isoformat()}",
        "is_mixed_load": True,
        "line_items": line_items,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "order_number": "MIX-ORD-001",
        "customer_id": line_items[0]['customer_id'],
        "customer_name": "MIXED LOAD",
        "customer_gstin": None,
        "place_of_supply": "Multiple",
        "item_id": None,
        "item_name": f"{len(line_items)} Items",
        "item_rate": None,
        "marka": None,
        "bharti": 50,
        "expected_weight": f"{total_expected} kg total",
        "has_broker": True,
        "broker_id": None,
        "broker_name": "Test Mixed Load Broker",
        "brokerage_type": "per_quintal",
        "brokerage_rate": 5.0,
        "remarks": "Test mixed load pre-entry for UI testing",
        "status": "pending",  # Will set to pending after weighbridge
        "weighbridge_completed": False,
        "weighbridge_slip_id": None,
        "tare_weight": None,
        "gross_weight": None,
        "net_weight": None,
        "created_by": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    
    # Delete existing test pre-entry if exists
    await db.sales_pre_entries.delete_many({"pre_entry_number": pre_entry_number})
    
    # Insert new pre-entry
    await db.sales_pre_entries.insert_one(pre_entry_doc)
    print(f"✅ Created mixed load pre-entry: {pre_entry_number}")
    print(f"   - {len(line_items)} line items")
    print(f"   - Total expected weight: {total_expected} kg ({total_expected/100} qtl)")
    
    # 4. Create TARE weighbridge entry
    tare_entry = {
        "id": str(uuid.uuid4()),
        "slip_id": pre_entry_number,
        "transaction_type": "sale",
        "weight_type": "tare",
        "vehicle_number": "MH12MX9999",
        "driver_name": "Mixed Load Driver",
        "vehicle_type": "Truck",
        "gross_weight": None,
        "tare_weight": 8000.0,
        "net_weight": None,
        "bags": None,
        "rem_kg": None,
        "act_qtl": None,
        "photo_gross": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2UwZTBlMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM2NjY2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5UYXJlIFdlaWdodCBQaG90bzwvdGV4dD48L3N2Zz4=",
        "photo_tare": None,
        "approval_status": "pending",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "admin"
    }
    
    await db.weighbridge_entries.insert_one(tare_entry)
    print(f"✅ Created TARE weighbridge entry: {tare_entry['tare_weight']} kg")
    
    # 5. Create GROSS weighbridge entry
    actual_net_weight = total_expected + 50  # Slightly more than expected (within variance)
    gross_weight = tare_entry['tare_weight'] + actual_net_weight
    
    gross_entry = {
        "id": str(uuid.uuid4()),
        "slip_id": pre_entry_number,
        "transaction_type": "sale",
        "weight_type": "gross",
        "vehicle_number": "MH12MX9999",
        "driver_name": "Mixed Load Driver",
        "vehicle_type": "Truck",
        "gross_weight": gross_weight,
        "tare_weight": tare_entry['tare_weight'],
        "net_weight": actual_net_weight,
        "bags": int(actual_net_weight / 50),
        "rem_kg": actual_net_weight % 50,
        "act_qtl": actual_net_weight / 100,
        "photo_gross": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2UwZTBlMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM2NjY2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Hcm9zcyBXZWlnaHQgUGhvdG88L3RleHQ+PC9zdmc+",
        "photo_tare": "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iI2UwZTBlMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM2NjY2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5UYXJlIFdlaWdodCBQaG90bzwvdGV4dD48L3N2Zz4=",
        "approval_status": "pending",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "admin"
    }
    
    await db.weighbridge_entries.insert_one(gross_entry)
    print(f"✅ Created GROSS weighbridge entry:")
    print(f"   - Gross: {gross_weight} kg")
    print(f"   - Tare: {tare_entry['tare_weight']} kg")
    print(f"   - Net: {actual_net_weight} kg ({actual_net_weight/100} qtl)")
    
    # 6. Update pre-entry with weighbridge data
    await db.sales_pre_entries.update_one(
        {"pre_entry_number": pre_entry_number},
        {"$set": {
            "status": "pending",
            "weighbridge_completed": True,
            "tare_weight": tare_entry['tare_weight'],
            "gross_weight": gross_weight,
            "net_weight": actual_net_weight,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    print(f"✅ Updated pre-entry status to 'pending' with weighbridge data")
    
    print("\n✅ TEST DATA CREATED SUCCESSFULLY!")
    print(f"\n📦 Mixed Load Pre-Entry: {pre_entry_number}")
    print(f"   Status: pending (ready for invoice processing)")
    print(f"   Line Items: {len(line_items)}")
    for i, item in enumerate(line_items, 1):
        print(f"   {i}. {item['customer_name']} - {item['item_name']} - {item['expected_weight']} kg")
    print(f"\n🎯 Go to Sales Invoice page to see the '📦 Split Load' button!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_data())
