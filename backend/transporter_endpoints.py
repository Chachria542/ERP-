"""
Transporter Master Data - API Endpoints
"""
from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime, timezone

from transporter_models import Transporter, TransporterCreate

router = APIRouter()

# Import database from server
from server import db

@router.post("/transporters", response_model=Transporter)
async def create_transporter(transporter: TransporterCreate):
    """Create a new transporter"""
    try:
        transporter_doc = transporter.dict()
        transporter_doc['created_at'] = datetime.now(timezone.utc).isoformat()
        transporter_doc['updated_at'] = None
        
        # Generate ID
        import uuid
        transporter_doc['id'] = str(uuid.uuid4())
        
        await db.transporters.insert_one(transporter_doc)
        
        print(f"[BACKEND] Created transporter: {transporter_doc['name']}")
        
        # Return without _id
        transporter_doc.pop('_id', None)
        return transporter_doc
        
    except Exception as e:
        print(f"[BACKEND] Error creating transporter: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/transporters", response_model=List[Transporter])
async def list_transporters(active: bool = None):
    """List all transporters"""
    query = {}
    if active is not None:
        query['active'] = active
    
    transporters = await db.transporters.find(query, {"_id": 0}).sort("name", 1).to_list(length=None)
    return transporters

@router.get("/transporters/search/{query}")
async def search_transporters(query: str):
    """Search transporters by name"""
    try:
        # Case-insensitive regex search
        transporters = await db.transporters.find(
            {
                "name": {"$regex": query, "$options": "i"},
                "active": True
            },
            {"_id": 0}
        ).sort("name", 1).limit(10).to_list(10)
        
        return transporters
        
    except Exception as e:
        print(f"[BACKEND] Error searching transporters: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/transporters/{transporter_id}", response_model=Transporter)
async def get_transporter(transporter_id: str):
    """Get transporter by ID"""
    transporter = await db.transporters.find_one({"id": transporter_id}, {"_id": 0})
    
    if not transporter:
        raise HTTPException(status_code=404, detail="Transporter not found")
    
    return transporter

@router.put("/transporters/{transporter_id}", response_model=Transporter)
async def update_transporter(transporter_id: str, transporter: TransporterCreate):
    """Update transporter"""
    try:
        existing = await db.transporters.find_one({"id": transporter_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Transporter not found")
        
        update_data = transporter.dict()
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        await db.transporters.update_one(
            {"id": transporter_id},
            {"$set": update_data}
        )
        
        print(f"[BACKEND] Updated transporter: {transporter_id}")
        
        # Return updated transporter
        updated = await db.transporters.find_one({"id": transporter_id}, {"_id": 0})
        return updated
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BACKEND] Error updating transporter: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/transporters/{transporter_id}")
async def delete_transporter(transporter_id: str):
    """Soft delete transporter (set active=False)"""
    try:
        result = await db.transporters.update_one(
            {"id": transporter_id},
            {"$set": {"active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Transporter not found")
        
        print(f"[BACKEND] Deactivated transporter: {transporter_id}")
        
        return {"message": "Transporter deactivated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[BACKEND] Error deleting transporter: {e}")
        raise HTTPException(status_code=400, detail=str(e))
