"""
Company Settings Module - API Endpoints
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
import uuid

from company_settings_models import CompanySettings, CompanySettingsCreate

router = APIRouter()

# Import database from server
from server import db

@router.get("/company-settings", response_model=CompanySettings)
async def get_company_settings():
    """Get company settings (only one record exists)"""
    settings = await db.company_settings.find_one({}, {"_id": 0})
    
    if not settings:
        raise HTTPException(status_code=404, detail="Company settings not found. Please configure company settings first.")
    
    return settings

@router.post("/company-settings", response_model=CompanySettings)
async def create_or_update_company_settings(settings_data: CompanySettingsCreate):
    """Create or update company settings (admin only)"""
    try:
        # Check if settings already exist
        existing = await db.company_settings.find_one({})
        
        if existing:
            # Update existing settings
            update_data = settings_data.dict()
            update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
            update_data['updated_by'] = settings_data.created_by
            
            await db.company_settings.update_one(
                {"id": existing['id']},
                {"$set": update_data}
            )
            
            settings_id = existing['id']
            print(f"[BACKEND] Updated company settings: {settings_id}")
        else:
            # Create new settings
            settings_id = str(uuid.uuid4())
            settings_doc = {
                "id": settings_id,
                **settings_data.dict(),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": None,
                "updated_by": None
            }
            
            await db.company_settings.insert_one(settings_doc)
            print(f"[BACKEND] Created company settings: {settings_id}")
        
        # Fetch and return the settings
        settings = await db.company_settings.find_one({"id": settings_id}, {"_id": 0})
        return settings
        
    except Exception as e:
        print(f"[BACKEND] Error saving company settings: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/company-settings/exists")
async def check_company_settings_exist():
    """Check if company settings exist"""
    settings = await db.company_settings.find_one({})
    return {"exists": settings is not None}
