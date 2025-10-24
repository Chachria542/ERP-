#!/usr/bin/env python3
"""
Focused OTP Verification System Test
Tests the complete OTP flow including integration with farmer creation
"""
import requests
import json
import time
import subprocess
import re

BASE_URL = "https://trading-platform-95.preview.emergentagent.com/api"

def get_otp_from_logs(mobile):
    """Extract OTP from backend logs for a specific mobile"""
    try:
        result = subprocess.run(['tail', '-n', '200', '/var/log/supervisor/backend.out.log'], 
                              capture_output=True, text=True)
        logs = result.stdout
        
        # Look for the OTP pattern for this mobile
        pattern = rf"📱 \[MOCK SMS\] Sending OTP to {mobile}: (\d+)"
        matches = re.findall(pattern, logs)
        
        if matches:
            return matches[-1]  # Return the most recent OTP
        return None
    except:
        return None

def test_complete_otp_flow():
    """Test the complete OTP verification flow"""
    print("🚀 Testing Complete OTP Verification Flow")
    print("=" * 60)
    
    test_mobile = "9876540001"
    
    # Step 1: Check initial verification status
    print("1️⃣ Checking initial verification status...")
    response = requests.get(f"{BASE_URL}/otp/check-verification/{test_mobile}")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Initial status: farmer_exists={data.get('farmer_exists')}, verified={data.get('verified')}")
    else:
        print(f"   ❌ Failed to check status: {response.status_code}")
        return False
    
    # Step 2: Send OTP
    print("2️⃣ Sending OTP...")
    response = requests.post(f"{BASE_URL}/otp/send", 
                           json={"mobile": test_mobile},
                           headers={'Content-Type': 'application/json'})
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ OTP sent successfully. Expires in {data.get('expires_in')} seconds")
    else:
        print(f"   ❌ Failed to send OTP: {response.status_code} - {response.text}")
        return False
    
    # Step 3: Extract OTP from logs
    print("3️⃣ Extracting OTP from logs...")
    time.sleep(1)  # Wait for logs
    actual_otp = get_otp_from_logs(test_mobile)
    if actual_otp:
        print(f"   ✅ Found OTP in logs: {actual_otp}")
    else:
        print("   ❌ Could not extract OTP from logs")
        return False
    
    # Step 4: Verify OTP
    print("4️⃣ Verifying OTP...")
    response = requests.post(f"{BASE_URL}/otp/verify", 
                           json={"mobile": test_mobile, "otp": actual_otp},
                           headers={'Content-Type': 'application/json'})
    if response.status_code == 200:
        data = response.json()
        if data.get('verified'):
            print(f"   ✅ OTP verified successfully")
        else:
            print(f"   ❌ OTP verification failed: {data}")
            return False
    else:
        print(f"   ❌ OTP verification failed: {response.status_code} - {response.text}")
        return False
    
    # Step 5: Check verification status after OTP verification
    print("5️⃣ Checking verification status after OTP verification...")
    response = requests.get(f"{BASE_URL}/otp/check-verification/{test_mobile}")
    if response.status_code == 200:
        data = response.json()
        print(f"   📊 Status after OTP: farmer_exists={data.get('farmer_exists')}, verified={data.get('verified')}")
        
        # Note: If farmer_exists is still False, it means OTP verification doesn't create farmer records
        # This might be by design - farmers are created during pre-entry creation
        if not data.get('farmer_exists'):
            print("   ℹ️  Note: OTP verification doesn't create farmer records (farmers created during pre-entry)")
    else:
        print(f"   ❌ Failed to check status: {response.status_code}")
        return False
    
    # Step 6: Test integration with pre-entry creation (create farmer)
    print("6️⃣ Testing integration with farmer creation...")
    
    # Get available items first
    items_response = requests.get(f"{BASE_URL}/items")
    if items_response.status_code == 200:
        items = items_response.json()
        if items:
            item_id = items[0]['id']
            
            # Create pre-entry which should create farmer
            pre_entry_data = {
                "transaction_type": "farmer_purchase",
                "from_location": "Test Warehouse",
                "party_type": "farmer",
                "party_name": "Test Farmer OTP",
                "party_mobile": test_mobile,
                "item_id": item_id,
                "rate_per_qtl": 2500.0,
                "expected_bags": 50,
                "created_by": "test_user"
            }
            
            response = requests.post(f"{BASE_URL}/pre-entry", 
                                   json=pre_entry_data,
                                   headers={'Content-Type': 'application/json'})
            
            if response.status_code == 200:
                pre_entry = response.json()
                print(f"   ✅ Pre-entry created: {pre_entry.get('slip_id')}")
                
                # Now check farmer status again
                response = requests.get(f"{BASE_URL}/otp/check-verification/{test_mobile}")
                if response.status_code == 200:
                    data = response.json()
                    print(f"   📊 Final status: farmer_exists={data.get('farmer_exists')}, verified={data.get('verified')}")
                    
                    if data.get('farmer_exists') and data.get('verified'):
                        print("   🎉 Complete integration working: Farmer created and verified!")
                        return True
                    elif data.get('farmer_exists') and not data.get('verified'):
                        print("   ⚠️  Farmer created but verification status not preserved")
                        return False
                    else:
                        print("   ❌ Integration issue: Farmer not created properly")
                        return False
            else:
                print(f"   ❌ Failed to create pre-entry: {response.status_code} - {response.text}")
                return False
        else:
            print("   ❌ No items available for pre-entry creation")
            return False
    else:
        print(f"   ❌ Failed to get items: {items_response.status_code}")
        return False

def test_otp_edge_cases():
    """Test OTP edge cases"""
    print("\n🔍 Testing OTP Edge Cases")
    print("=" * 60)
    
    test_mobile = "9876540002"
    
    # Test 1: Invalid OTP
    print("1️⃣ Testing invalid OTP...")
    response = requests.post(f"{BASE_URL}/otp/send", 
                           json={"mobile": test_mobile},
                           headers={'Content-Type': 'application/json'})
    
    if response.status_code == 200:
        # Try invalid OTP
        response = requests.post(f"{BASE_URL}/otp/verify", 
                               json={"mobile": test_mobile, "otp": "0000"},
                               headers={'Content-Type': 'application/json'})
        
        if response.status_code == 400:
            data = response.json()
            if "Invalid OTP" in data.get("detail", ""):
                print("   ✅ Invalid OTP correctly rejected")
            else:
                print(f"   ❌ Wrong error message: {data.get('detail')}")
        else:
            print(f"   ❌ Expected 400, got {response.status_code}")
    else:
        print(f"   ❌ Failed to send OTP: {response.status_code}")
    
    # Test 2: Non-existent mobile verification
    print("2️⃣ Testing non-existent mobile verification...")
    response = requests.post(f"{BASE_URL}/otp/verify", 
                           json={"mobile": "9999999999", "otp": "1234"},
                           headers={'Content-Type': 'application/json'})
    
    if response.status_code == 404:
        data = response.json()
        if "No OTP found" in data.get("detail", ""):
            print("   ✅ Non-existent mobile correctly handled")
        else:
            print(f"   ❌ Wrong error message: {data.get('detail')}")
    else:
        print(f"   ❌ Expected 404, got {response.status_code}")
    
    # Test 3: Check OTP format (should be 4 digits)
    print("3️⃣ Testing OTP format...")
    time.sleep(1)
    actual_otp = get_otp_from_logs(test_mobile)
    if actual_otp:
        if len(actual_otp) == 4 and actual_otp.isdigit():
            print(f"   ✅ OTP format correct: {actual_otp} (4 digits)")
        else:
            print(f"   ❌ OTP format incorrect: {actual_otp} (expected 4 digits)")
    else:
        print("   ❌ Could not extract OTP for format check")

def test_database_integration():
    """Test database integration"""
    print("\n💾 Testing Database Integration")
    print("=" * 60)
    
    # Test 1: Check if farmers endpoint shows verification fields
    print("1️⃣ Checking farmer model verification fields...")
    response = requests.get(f"{BASE_URL}/farmers")
    
    if response.status_code == 200:
        farmers = response.json()
        if farmers:
            sample_farmer = farmers[0]
            verification_fields = ["mobile_verified", "mobile_verified_at", "otp_verified_count"]
            present_fields = [field for field in verification_fields if field in sample_farmer]
            
            if len(present_fields) == len(verification_fields):
                print(f"   ✅ All verification fields present: {present_fields}")
            else:
                missing = [field for field in verification_fields if field not in sample_farmer]
                print(f"   ❌ Missing verification fields: {missing}")
        else:
            print("   ℹ️  No farmers in database to check model structure")
    else:
        print(f"   ❌ Failed to get farmers: {response.status_code}")
    
    # Test 2: Check OTP storage (indirect test)
    print("2️⃣ Testing OTP storage and attempt tracking...")
    test_mobile = "9876540003"
    
    # Send OTP
    response = requests.post(f"{BASE_URL}/otp/send", 
                           json={"mobile": test_mobile},
                           headers={'Content-Type': 'application/json'})
    
    if response.status_code == 200:
        # Try wrong OTP multiple times
        for attempt in range(3):
            response = requests.post(f"{BASE_URL}/otp/verify", 
                                   json={"mobile": test_mobile, "otp": "0000"},
                                   headers={'Content-Type': 'application/json'})
            
            if response.status_code == 400:
                data = response.json()
                if "attempts remaining" in data.get("detail", ""):
                    print(f"   ✅ Attempt {attempt + 1}: Tracking working - {data.get('detail')}")
                elif "Maximum attempts exceeded" in data.get("detail", ""):
                    print(f"   ✅ Max attempts exceeded after {attempt + 1} attempts")
                    break
                else:
                    print(f"   ❌ Unexpected error: {data.get('detail')}")
                    break
            else:
                print(f"   ❌ Expected 400, got {response.status_code}")
                break
    else:
        print(f"   ❌ Failed to send OTP: {response.status_code}")

if __name__ == "__main__":
    print("🧪 OTP Verification System - Focused Testing")
    print("=" * 80)
    
    success = True
    
    try:
        # Test complete flow
        if not test_complete_otp_flow():
            success = False
        
        # Test edge cases
        test_otp_edge_cases()
        
        # Test database integration
        test_database_integration()
        
        print("\n" + "=" * 80)
        if success:
            print("🎉 FOCUSED TESTING COMPLETED - Core OTP functionality working!")
        else:
            print("⚠️  FOCUSED TESTING COMPLETED - Some issues found")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ Test execution failed: {str(e)}")
        success = False
    
    exit(0 if success else 1)