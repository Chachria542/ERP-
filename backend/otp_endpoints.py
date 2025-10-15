"""
OTP Verification Endpoints
Handles mobile OTP verification for farmer authentication
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta
from universal_weighbridge_models import OTPVerification, OTPSendRequest, OTPVerifyRequest
import random

router = APIRouter()
db = None

def init_db(database):
    global db
    db = database

# ============= HELPER FUNCTIONS =============

def generate_otp() -> str:
    """Generate 4-digit OTP"""
    return str(random.randint(1000, 9999))

def send_sms_mock(mobile: str, otp: str):
    """Mock SMS sending - logs OTP to console"""
    print(f"📱 [MOCK SMS] Sending OTP to {mobile}: {otp}")
    print(f"   (In production, this will use real SMS gateway)")
    return True

async def check_farmer_exists(mobile: str) -> bool:
    """Check if farmer with mobile already exists"""
    farmer = await db.farmers.find_one({"mobile": mobile})
    return farmer is not None

async def check_farmer_verified(mobile: str) -> bool:
    """Check if farmer's mobile is already verified"""
    farmer = await db.farmers.find_one({"mobile": mobile})
    if farmer and farmer.get('mobile_verified'):
        return True
    return False

# ============= OTP ENDPOINTS =============

@router.post("/otp/send")
async def send_otp(request: OTPSendRequest):
    """
    Send OTP to mobile number.
    Only sends if farmer is NEW (doesn't exist or not verified).
    """
    try:
        # Check if farmer exists and is verified
        farmer_exists = await check_farmer_exists(request.mobile)
        farmer_verified = await check_farmer_verified(request.mobile)
        
        if farmer_exists and farmer_verified:
            return {
                "message": "Mobile already verified",
                "requires_otp": False,
                "farmer_exists": True,
                "verified": True
            }
        
        # Check for recent OTP (within resend cooldown)
        recent_otp = await db.otp_verifications.find_one(
            {
                "mobile": request.mobile,
                "verified": False,
                "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
            },
            sort=[("created_at", -1)]
        )
        
        if recent_otp and recent_otp.get('last_resend_at'):
            last_resend = datetime.fromisoformat(recent_otp['last_resend_at'])
            cooldown_end = last_resend + timedelta(seconds=60)
            now = datetime.now(timezone.utc)
            
            if now < cooldown_end:
                remaining = int((cooldown_end - now).total_seconds())
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {remaining} seconds before requesting new OTP"
                )
        
        # Generate OTP
        otp = generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=2)
        
        # Create OTP record
        otp_record = OTPVerification(
            mobile=request.mobile,
            otp=otp,  # In production, hash this
            expires_at=expires_at,
            last_resend_at=datetime.now(timezone.utc)
        )
        
        doc = otp_record.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['expires_at'] = doc['expires_at'].isoformat()
        doc['last_resend_at'] = doc['last_resend_at'].isoformat()
        
        # Save to database
        await db.otp_verifications.insert_one(doc)
        
        # Send SMS (mock)
        send_sms_mock(request.mobile, otp)
        
        return {
            "message": "OTP sent successfully",
            "mobile": request.mobile,
            "expires_in": 120,  # 2 minutes
            "requires_otp": True,
            "farmer_exists": farmer_exists,
            "verified": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/otp/verify")
async def verify_otp(request: OTPVerifyRequest):
    """
    Verify OTP for mobile number.
    Updates farmer's mobile_verified status on success.
    """
    try:
        print(f"[OTP VERIFY] Request received - Mobile: {request.mobile}, OTP: {request.otp}")
        
        # Find latest OTP for this mobile
        otp_record = await db.otp_verifications.find_one(
            {
                "mobile": request.mobile,
                "verified": False
            },
            sort=[("created_at", -1)]
        )
        
        if not otp_record:
            print(f"[OTP VERIFY ERROR] No OTP found for mobile: {request.mobile}")
            raise HTTPException(status_code=404, detail="No OTP found for this mobile. Please request new OTP.")
        
        print(f"[OTP VERIFY] Found OTP record - Stored OTP: {otp_record.get('otp')}, Attempts: {otp_record.get('attempts')}, Expires: {otp_record.get('expires_at')}")
        
        # Check if expired
        expires_at = datetime.fromisoformat(otp_record['expires_at'])
        now = datetime.now(timezone.utc)
        if now > expires_at:
            print(f"[OTP VERIFY ERROR] OTP expired - Now: {now}, Expires: {expires_at}")
            raise HTTPException(status_code=400, detail="OTP expired. Please request new OTP.")
        
        # Check max attempts
        if otp_record['attempts'] >= otp_record['max_attempts']:
            print(f"[OTP VERIFY ERROR] Max attempts exceeded - Attempts: {otp_record['attempts']}/{otp_record['max_attempts']}")
            raise HTTPException(status_code=400, detail="Maximum attempts exceeded. Please request new OTP.")
        
        # Increment attempts
        await db.otp_verifications.update_one(
            {"id": otp_record['id']},
            {"$inc": {"attempts": 1}}
        )
        
        # Verify OTP
        if request.otp != otp_record['otp']:
            remaining_attempts = otp_record['max_attempts'] - (otp_record['attempts'] + 1)
            print(f"[OTP VERIFY ERROR] Invalid OTP - Expected: {otp_record['otp']}, Received: {request.otp}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid OTP. {remaining_attempts} attempts remaining."
            )
        
        # Mark OTP as verified
        await db.otp_verifications.update_one(
            {"id": otp_record['id']},
            {"$set": {"verified": True}}
        )
        
        # Update or create farmer with verification status
        farmer = await db.farmers.find_one({"mobile": request.mobile})
        
        if farmer:
            # Update existing farmer
            await db.farmers.update_one(
                {"mobile": request.mobile},
                {
                    "$set": {
                        "mobile_verified": True,
                        "mobile_verified_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$inc": {"otp_verified_count": 1}
                }
            )
        # If farmer doesn't exist, verification status will be set during creation
        
        print(f"[OTP VERIFY SUCCESS] OTP verified for mobile: {request.mobile}")
        
        return {
            "message": "OTP verified successfully",
            "mobile": request.mobile,
            "verified": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[OTP VERIFY ERROR] Exception: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/otp/resend")
async def resend_otp(request: OTPSendRequest):
    """
    Resend OTP to mobile number.
    Enforces 60-second cooldown between resends.
    """
    # Invalidate previous OTP
    await db.otp_verifications.update_many(
        {"mobile": request.mobile, "verified": False},
        {"$set": {"verified": True}}  # Mark as used
    )
    
    # Send new OTP (will check cooldown)
    return await send_otp(request)

@router.get("/otp/check-verification/{mobile}")
async def check_verification_status(mobile: str):
    """
    Check if mobile number requires OTP verification.
    Returns farmer_exists and verified status.
    """
    farmer = await db.farmers.find_one({"mobile": mobile})
    
    if not farmer:
        return {
            "mobile": mobile,
            "farmer_exists": False,
            "verified": False,
            "requires_otp": True
        }
    
    return {
        "mobile": mobile,
        "farmer_exists": True,
        "verified": farmer.get('mobile_verified', False),
        "requires_otp": not farmer.get('mobile_verified', False),
        "farmer_name": farmer.get('name')
    }
