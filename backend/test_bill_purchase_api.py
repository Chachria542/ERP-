#!/usr/bin/env python3
"""
Test script for Bill Purchase API endpoints
"""
import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://grain-tracker-erp.preview.emergentagent.com/api"

def test_create_supplier():
    """Test creating a supplier party"""
    print("🧪 Testing supplier creation...")
    
    supplier_data = {
        "name": "Test Supplier Ltd",
        "roles": ["supplier"],
        "contact": "9876543210",
        "address": "123 Supplier Street, Mumbai",
        "gstin": "27AAAAA0000A1Z5",
        "state": "Maharashtra", 
        "place_of_supply": "Mumbai",
        "pan": "AAAAA0000A",
        "bank_name": "Test Bank",
        "account_number": "1234567890",
        "ifsc_code": "TEST0001234"
    }
    
    response = requests.post(f"{BASE_URL}/suppliers", json=supplier_data)
    
    if response.status_code == 200:
        supplier = response.json()
        print(f"   ✅ Supplier created: {supplier['name']} (ID: {supplier['id']})")
        return supplier['id']
    else:
        print(f"   ❌ Failed to create supplier: {response.status_code} - {response.text}")
        return None

def test_get_suppliers():
    """Test getting suppliers list"""
    print("🧪 Testing suppliers list...")
    
    response = requests.get(f"{BASE_URL}/suppliers")
    
    if response.status_code == 200:
        suppliers = response.json()
        print(f"   ✅ Found {len(suppliers)} suppliers")
        return suppliers
    else:
        print(f"   ❌ Failed to get suppliers: {response.status_code} - {response.text}")
        return []

def test_create_pre_entry(supplier_id):
    """Test creating bill purchase pre-entry"""
    print("🧪 Testing pre-entry creation...")
    
    pre_entry_data = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "supplier_id": supplier_id,
        "supplier_gstin": "27AAAAA0000A1Z5",
        "place_of_supply": "Mumbai, Maharashtra",
        "has_broker": True,
        "broker_name": "Test Broker",
        "brokerage_type": "per_quintal",
        "brokerage_rate": 5.0,
        "eway_bill_no": "EWB123456789012",
        "expected_quantity_bags": 100,
        "expected_quantity_qtls": 100.0,
        "remarks": "Test pre-entry for API testing",
        "created_by": "test_user"
    }
    
    response = requests.post(f"{BASE_URL}/bill-purchase/pre-entry", json=pre_entry_data)
    
    if response.status_code == 200:
        pre_entry = response.json()
        print(f"   ✅ Pre-entry created: {pre_entry['pre_entry_number']}")
        return pre_entry
    else:
        print(f"   ❌ Failed to create pre-entry: {response.status_code} - {response.text}")
        return None

def test_get_pre_entries():
    """Test getting pre-entries list"""
    print("🧪 Testing pre-entries list...")
    
    response = requests.get(f"{BASE_URL}/bill-purchase/pre-entries")
    
    if response.status_code == 200:
        pre_entries = response.json()
        print(f"   ✅ Found {len(pre_entries)} pre-entries")
        return pre_entries
    else:
        print(f"   ❌ Failed to get pre-entries: {response.status_code} - {response.text}")
        return []

def test_get_queue():
    """Test getting bill purchase queue"""
    print("🧪 Testing bill purchase queue...")
    
    response = requests.get(f"{BASE_URL}/bill-purchase/queue?status=weigh_pending")
    
    if response.status_code == 200:
        queue_items = response.json()
        print(f"   ✅ Found {len(queue_items)} items in queue")
        return queue_items
    else:
        print(f"   ❌ Failed to get queue: {response.status_code} - {response.text}")
        return []

def test_duplicate_eway_bill(supplier_id):
    """Test duplicate E-Way bill validation"""
    print("🧪 Testing duplicate E-Way bill validation...")
    
    # Create first pre-entry
    pre_entry_data = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "supplier_id": supplier_id,
        "place_of_supply": "Delhi",
        "has_broker": False,
        "eway_bill_no": "DUPLICATE123456",
        "created_by": "test_user"
    }
    
    response1 = requests.post(f"{BASE_URL}/bill-purchase/pre-entry", json=pre_entry_data)
    
    if response1.status_code == 200:
        print("   ✅ First pre-entry with E-Way bill created")
        
        # Try to create duplicate
        response2 = requests.post(f"{BASE_URL}/bill-purchase/pre-entry", json=pre_entry_data)
        
        if response2.status_code == 400 and "Duplicate" in response2.text:
            print("   ✅ Duplicate E-Way bill correctly rejected")
        else:
            print(f"   ❌ Duplicate validation failed: {response2.status_code} - {response2.text}")
    else:
        print(f"   ❌ Failed to create first pre-entry: {response1.status_code} - {response1.text}")

def run_tests():
    """Run all tests"""
    print("🚀 Starting Bill Purchase API Tests")
    print("=" * 50)
    
    # Test 1: Create supplier
    supplier_id = test_create_supplier()
    if not supplier_id:
        print("❌ Cannot continue tests without supplier")
        return
    
    # Test 2: Get suppliers
    suppliers = test_get_suppliers()
    
    # Test 3: Create pre-entry
    pre_entry = test_create_pre_entry(supplier_id)
    
    # Test 4: Get pre-entries
    pre_entries = test_get_pre_entries()
    
    # Test 5: Get queue
    queue_items = test_get_queue()
    
    # Test 6: Duplicate E-Way bill validation
    test_duplicate_eway_bill(supplier_id)
    
    print("\n" + "=" * 50)
    print("🎉 Bill Purchase API Tests Completed")

if __name__ == "__main__":
    run_tests()