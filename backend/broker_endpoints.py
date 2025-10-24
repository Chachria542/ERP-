"""
Broker Master Data API Endpoints
"""
from fastapi import APIRouter, HTTPException
from broker_models import Broker, BrokerCreate
from typing import List
from datetime import datetime, timezone

router = APIRouter()
db = None

def init_db(database):
    global db
    db = database

@router.post("/brokers", response_model=Broker)
async def create_broker(broker_data: BrokerCreate):
    """Create a new broker"""
    # Check for duplicate name
    existing = await db.brokers.find_one({"name": broker_data.name})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Broker with name '{broker_data.name}' already exists"
        )
    
    broker = Broker(**broker_data.model_dump())
    doc = broker.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('updated_at'):
        doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.brokers.insert_one(doc)
    return broker

@router.get("/brokers", response_model=List[Broker])
async def list_brokers(active_only: bool = True):
    """List all brokers"""
    query = {"active": True} if active_only else {}
    brokers = await db.brokers.find(query).to_list(length=None)
    return brokers

@router.get("/brokers/{broker_id}", response_model=Broker)
async def get_broker(broker_id: str):
    """Get broker by ID"""
    broker = await db.brokers.find_one({"id": broker_id})
    if not broker:
        raise HTTPException(status_code=404, detail="Broker not found")
    return broker

@router.put("/brokers/{broker_id}", response_model=Broker)
async def update_broker(broker_id: str, broker_data: BrokerCreate):
    """Update broker details"""
    broker = await db.brokers.find_one({"id": broker_id})
    if not broker:
        raise HTTPException(status_code=404, detail="Broker not found")
    
    update_data = broker_data.model_dump()
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.brokers.update_one(
        {"id": broker_id},
        {"$set": update_data}
    )
    
    updated_broker = await db.brokers.find_one({"id": broker_id})
    return updated_broker

@router.delete("/brokers/{broker_id}")
async def delete_broker(broker_id: str):
    """Soft delete broker (mark as inactive)"""
    broker = await db.brokers.find_one({"id": broker_id})
    if not broker:
        raise HTTPException(status_code=404, detail="Broker not found")
    
    await db.brokers.update_one(
        {"id": broker_id},
        {"$set": {"active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Broker deactivated successfully"}

@router.get("/brokers/search/{query}")
async def search_brokers(query: str):
    """Search brokers by name"""
    try:
        # Case-insensitive regex search
        brokers = await db.brokers.find(
            {
                "name": {"$regex": query, "$options": "i"},
                "active": True
            }
        ).sort("name", 1).limit(10).to_list(10)
        
        # Remove _id from results
        for broker in brokers:
            broker.pop('_id', None)
        
        return brokers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
