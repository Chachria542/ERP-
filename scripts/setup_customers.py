#!/usr/bin/env python3
"""
Setup script to create test customers for Sales Module
"""
import sys
sys.path.append('/app/backend')

import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'sudarshan_erp')

async def setup_customers():
    """Create test customers"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔗 Connected to MongoDB")
    print(f"📊 Database: {DB_NAME}")
    
    # Sample customers
    customers = [
        {
            "id": str(uuid.uuid4()),
            "name": "Rajesh Traders",
            "roles": ["customer"],
            "contact": "9876543210",
            "address": "Shop No. 45, Grain Market, Mumbai",
            "gstin": "27AAAAA1234A1Z5",
            "state": "Maharashtra",
            "place_of_supply": "Mumbai, Maharashtra",
            "pan": "AAAAA1234A",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Lakshmi Rice Mills",
            "roles": ["customer"],
            "contact": "9123456789",
            "address": "12/A, Industrial Area, Pune",
            "gstin": "27BBBBB5678B2Z6",
            "state": "Maharashtra",
            "place_of_supply": "Pune, Maharashtra",
            "pan": "BBBBB5678B",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Vishwakarma Grain Depot",
            "roles": ["customer"],
            "contact": "9988776655",
            "address": "Plot 23, APMC Market, Nashik",
            "gstin": "27CCCCC9012C3Z7",
            "state": "Maharashtra",
            "place_of_supply": "Nashik, Maharashtra",
            "pan": "CCCCC9012C",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Sai Provisions",
            "roles": ["customer"],
            "contact": "9445566778",
            "address": "456, Main Road, Nagpur",
            "gstin": "27DDDDD3456D4Z8",
            "state": "Maharashtra",
            "place_of_supply": "Nagpur, Maharashtra",
            "pan": "DDDDD3456D",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Ganesh Wholesale Store",
            "roles": ["customer"],
            "contact": "9334455667",
            "address": "78, Market Yard, Aurangabad",
            "gstin": "27EEEEE7890E5Z9",
            "state": "Maharashtra",
            "place_of_supply": "Aurangabad, Maharashtra",
            "pan": "EEEEE7890E",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    # Insert customers
    print("\n📝 Creating customers...")
    inserted_count = 0
    
    for customer in customers:
        # Check if customer already exists
        existing = await db.parties.find_one({"name": customer["name"]})
        
        if existing:
            # Update roles to include customer
            if "customer" not in existing.get("roles", []):
                await db.parties.update_one(
                    {"name": customer["name"]},
                    {"$addToSet": {"roles": "customer"}}
                )
                print(f"  ✅ Updated roles for existing party: {customer['name']}")
        else:
            # Insert new customer
            await db.parties.insert_one(customer)
            print(f"  ✅ Created customer: {customer['name']}")
            inserted_count += 1
    
    print(f"\n✅ Total new customers created: {inserted_count}")
    
    # Verify customers
    all_customers = await db.parties.find({"roles": "customer"}, {"_id": 0}).to_list(100)
    print(f"📊 Total customers in database: {len(all_customers)}")
    
    print("\n✨ Customer setup complete!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_customers())
