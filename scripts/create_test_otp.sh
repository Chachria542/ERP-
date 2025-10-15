#!/bin/bash
# Quick script to create a test OTP

MOBILE=${1:-9999999999}

cd /app/backend && python3 << EOF
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
import random

async def create_test_otp():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'sudarshan_erp')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    mobile = "$MOBILE"
    otp = str(random.randint(1000, 9999))
    
    await db.otp_verifications.delete_many({"mobile": mobile})
    
    otp_doc = {
        "mobile": mobile,
        "otp": otp,
        "verified": False,
        "attempts": 0,
        "expires_in": 120,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.otp_verifications.insert_one(otp_doc)
    
    print(f"\n✅ OTP Created: {otp} for mobile {mobile}\n")
    
    client.close()

asyncio.run(create_test_otp())
EOF
