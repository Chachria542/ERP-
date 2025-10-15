#!/usr/bin/env python3
"""
Helper script to get the latest OTP for a mobile number
Usage: python3 get_latest_otp.py <mobile_number>
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

async def get_latest_otp(mobile):
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'sudarshan_erp')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Get latest OTP for this mobile
    otp_record = await db.otp_verifications.find_one(
        {"mobile": mobile},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if otp_record:
        print(f"\n{'='*50}")
        print(f"📱 Mobile: {otp_record['mobile']}")
        print(f"🔐 OTP: {otp_record['otp']}")
        print(f"⏰ Created: {otp_record['created_at']}")
        print(f"✅ Verified: {otp_record.get('verified', False)}")
        print(f"⏳ Expires in: {otp_record.get('expires_in', 120)} seconds")
        print(f"{'='*50}\n")
    else:
        print(f"\n❌ No OTP found for mobile: {mobile}\n")
    
    client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 get_latest_otp.py <mobile_number>")
        print("Example: python3 get_latest_otp.py 1234567890")
        sys.exit(1)
    
    mobile = sys.argv[1]
    asyncio.run(get_latest_otp(mobile))
