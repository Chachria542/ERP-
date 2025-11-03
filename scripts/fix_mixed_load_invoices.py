"""
Migration script to fix existing mixed load pre-entries 
that don't have invoice_numbers stored.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def fix_mixed_load_invoices():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'grain_trading')
    print(f"Connecting to MongoDB database: {db_name}")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Test connection
    server_info = await client.server_info()
    print(f"✅ Connected to MongoDB version {server_info.get('version')}")
    
    # Find all mixed load pre-entries with invoice_generated status but no invoice_numbers
    print("Searching for mixed loads...")
    # First, let's see all pre-entries with invoice_generated status
    all_invoice_generated = await db.sales_pre_entries.find({
        "status": "invoice_generated"
    }).to_list(None)
    print(f"Total pre-entries with invoice_generated status: {len(all_invoice_generated)}")
    
    # Check which ones are mixed
    for entry in all_invoice_generated[:5]:
        print(f"  - {entry.get('pre_entry_number')}: is_mixed_load={entry.get('is_mixed_load')}, customer_name={entry.get('customer_name')}")
    
    mixed_loads = await db.sales_pre_entries.find({
        "is_mixed_load": True,
        "status": "invoice_generated"
    }).to_list(None)
    
    print(f"Found {len(mixed_loads)} mixed load pre-entries with invoice_generated status")
    
    # Filter those without invoice_numbers
    entries_to_fix = []
    for entry in mixed_loads:
        if not entry.get('invoice_numbers'):
            entries_to_fix.append(entry)
    
    print(f"Need to fix {len(entries_to_fix)} entries that don't have invoice_numbers")
    
    for pre_entry in entries_to_fix:
        pre_entry_id = pre_entry['id']
        pre_entry_number = pre_entry['pre_entry_number']
        
        # Find all invoices created from this pre-entry
        invoices = await db.sales_invoices.find({
            "pre_entry_id": pre_entry_id
        }).to_list(None)
        
        if invoices:
            invoice_numbers = [inv['invoice_number'] for inv in invoices]
            total_invoices = len(invoices)
            
            # Update the pre-entry
            result = await db.sales_pre_entries.update_one(
                {"id": pre_entry_id},
                {"$set": {
                    "invoice_numbers": invoice_numbers,
                    "total_invoices": total_invoices
                }}
            )
            
            print(f"✅ Updated {pre_entry_number}: Added {total_invoices} invoice numbers: {invoice_numbers}")
        else:
            print(f"⚠️  {pre_entry_number}: No invoices found (might need manual check)")
    
    print(f"\n✅ Migration complete! Fixed {len(entries_to_fix)} mixed load pre-entries")
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_mixed_load_invoices())
