#!/usr/bin/env python3
"""
Backend API Testing for Sales Pre-Entry System
Tests the new Sales Pre-Entry backend endpoints according to test_result.md
"""
import requests
import json
import sys
import time
from datetime import datetime, timezone, timedelta

# Backend URL from frontend/.env
BASE_URL = "https://trade-flow-17.preview.emergentagent.com/api"

class SalesPreEntryTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        # Test data
        self.customers = []
        self.items = []
        self.created_pre_entries = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
        if response_data and not success:
            print(f"    Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def setup_test_data(self):
        """Setup test data - get available customers and items"""
        print("🔧 Setting up test data...")
        
        try:
            # Get customers with customer role
            parties_response = requests.get(f"{self.base_url}/parties", timeout=10)
            if parties_response.status_code == 200:
                parties = parties_response.json()
                self.customers = [p for p in parties if "customer" in p.get("roles", [])]
                if len(self.customers) < 1:
                    self.log_test("Test Data Setup", False, "No customers found with 'customer' role")
                    return False
                self.log_test("Test Data Setup", True, f"Found {len(self.customers)} customers")
            else:
                self.log_test("Test Data Setup", False, f"Failed to get parties: HTTP {parties_response.status_code}")
                return False
            
            # Get available items
            items_response = requests.get(f"{self.base_url}/items", timeout=10)
            if items_response.status_code == 200:
                self.items = items_response.json()
                if len(self.items) < 1:
                    self.log_test("Test Data Setup", False, "No items available for testing")
                    return False
                self.log_test("Test Data Setup", True, f"Found {len(self.items)} items")
            else:
                self.log_test("Test Data Setup", False, f"Failed to get items: HTTP {items_response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Test Data Setup", False, f"Setup failed: {str(e)}")
            return False
        
        return True
    
    def test_sales_pre_entry_creation_basic(self):
        """
        Test 1: Basic Sales Pre-Entry Creation
        Test creating a sales pre-entry with all required fields
        """
        print("🔍 Test 1: Basic Sales Pre-Entry Creation...")
        
        if not self.customers or not self.items:
            self.log_test("Sales Pre-Entry Creation Basic", False, "No test data available")
            return False
        
        customer = self.customers[0]
        item = self.items[0]
        
        try:
            payload = {
                "date": "2025-01-14",
                "customer_id": customer['id'],
                "customer_gstin": customer.get('gstin'),
                "place_of_supply": customer.get('place_of_supply', 'Mumbai, Maharashtra'),
                "item_id": item['id'],
                "bharti": 50,
                "has_broker": True,
                "broker_name": "Test Broker",
                "brokerage_type": "per_quintal",
                "brokerage_rate": 10.0,
                "is_mandi": False,
                "location_name": "Main Godown",
                "expected_bags": 100,
                "expected_kgs": 5000.0,
                "order_number": "ORD-001",
                "marka": "Premium Quality",
                "remarks": "Test sales pre-entry creation",
                "created_by": "admin"
            }
            
            response = requests.post(f"{self.base_url}/sales/pre-entry", 
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ["pre_entry_number", "slip_id", "qr_code", "customer_name", "item_name"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    # Check pre-entry number format (SPRE-YY-######)
                    pre_entry_no = data.get("pre_entry_number")
                    if pre_entry_no and pre_entry_no.startswith("SPRE-") and len(pre_entry_no) == 13:
                        self.created_pre_entries.append(data)
                        self.log_test("Sales Pre-Entry Creation Basic", True, 
                                    f"✅ Created pre-entry: {pre_entry_no}, Customer: {data.get('customer_name')}, Item: {data.get('item_name')}")
                        return True
                    else:
                        self.log_test("Sales Pre-Entry Creation Basic", False, 
                                    f"Invalid pre-entry number format: {pre_entry_no}")
                        return False
                else:
                    self.log_test("Sales Pre-Entry Creation Basic", False, 
                                f"Missing required fields: {missing_fields}")
                    return False
            else:
                self.log_test("Sales Pre-Entry Creation Basic", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Sales Pre-Entry Creation Basic", False, f"Request failed: {str(e)}")
            return False
    
    def test_sales_pre_entry_sequential_numbering(self):
        """
        Test 2: Sequential Pre-Entry Number Generation
        Test that multiple pre-entries get sequential numbers
        """
        print("🔍 Test 2: Sequential Pre-Entry Number Generation...")
        
        if not self.customers or not self.items:
            self.log_test("Sequential Numbering", False, "No test data available")
            return False
        
        customer = self.customers[0]
        item = self.items[0]
        
        try:
            # Create first pre-entry
            payload1 = {
                "date": "2025-01-14",
                "customer_id": customer['id'],
                "place_of_supply": customer.get('place_of_supply', 'Mumbai, Maharashtra'),
                "item_id": item['id'],
                "created_by": "admin"
            }
            
            response1 = requests.post(f"{self.base_url}/sales/pre-entry", 
                                    json=payload1,
                                    headers={'Content-Type': 'application/json'},
                                    timeout=10)
            
            if response1.status_code != 200:
                self.log_test("Sequential Numbering", False, 
                            f"First pre-entry creation failed: HTTP {response1.status_code}")
                return False
            
            data1 = response1.json()
            pre_entry_no1 = data1.get("pre_entry_number")
            
            # Create second pre-entry
            payload2 = {
                "date": "2025-01-14",
                "customer_id": customer['id'],
                "place_of_supply": customer.get('place_of_supply', 'Mumbai, Maharashtra'),
                "item_id": item['id'],
                "created_by": "admin"
            }
            
            response2 = requests.post(f"{self.base_url}/sales/pre-entry", 
                                    json=payload2,
                                    headers={'Content-Type': 'application/json'},
                                    timeout=10)
            
            if response2.status_code != 200:
                self.log_test("Sequential Numbering", False, 
                            f"Second pre-entry creation failed: HTTP {response2.status_code}")
                return False
            
            data2 = response2.json()
            pre_entry_no2 = data2.get("pre_entry_number")
            
            # Verify sequential numbering
            if pre_entry_no1 and pre_entry_no2:
                # Extract numbers from SPRE-YY-###### format
                num1 = int(pre_entry_no1.split('-')[-1])
                num2 = int(pre_entry_no2.split('-')[-1])
                
                if num2 == num1 + 1:
                    self.created_pre_entries.extend([data1, data2])
                    self.log_test("Sequential Numbering", True, 
                                f"✅ Sequential numbering working: {pre_entry_no1} → {pre_entry_no2}")
                    return True
                else:
                    self.log_test("Sequential Numbering", False, 
                                f"❌ Non-sequential numbers: {pre_entry_no1} → {pre_entry_no2}")
                    return False
            else:
                self.log_test("Sequential Numbering", False, 
                            "❌ Missing pre-entry numbers in response")
                return False
                
        except Exception as e:
            self.log_test("Sequential Numbering", False, f"Request failed: {str(e)}")
            return False
    
    def test_marka_memory_endpoint(self):
        """
        Test 3: Marka Memory Endpoint
        Test fetching marka options for an item
        """
        print("🔍 Test 3: Marka Memory Endpoint...")
        
        if not self.items:
            self.log_test("Marka Memory Endpoint", False, "No items available for testing")
            return False
        
        item = self.items[0]
        item_id = item['id']
        
        try:
            # Test marka endpoint
            response = requests.get(f"{self.base_url}/sales/marka/{item_id}", timeout=10)
            
            if response.status_code == 200:
                markas = response.json()
                
                # Should return array (even if empty)
                if isinstance(markas, list):
                    self.log_test("Marka Memory Endpoint", True, 
                                f"✅ Marka endpoint working, returned {len(markas)} marka options for item {item['name']}")
                    return True
                else:
                    self.log_test("Marka Memory Endpoint", False, 
                                f"❌ Expected array, got: {type(markas)}")
                    return False
            else:
                self.log_test("Marka Memory Endpoint", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Marka Memory Endpoint", False, f"Request failed: {str(e)}")
            return False
    
    def get_otp_from_logs(self, mobile):
        """Extract OTP from backend logs for a specific mobile"""
        try:
            import subprocess
            result = subprocess.run(['tail', '-n', '100', '/var/log/supervisor/backend.out.log'], 
                                  capture_output=True, text=True)
            logs = result.stdout
            
            # Look for the OTP pattern for this mobile
            import re
            pattern = rf"📱 \[MOCK SMS\] Sending OTP to {mobile}: (\d+)"
            matches = re.findall(pattern, logs)
            
            if matches:
                return matches[-1]  # Return the most recent OTP
            return None
        except:
            return None
    
    def send_and_verify_otp(self, mobile):
        """Helper method to send and verify OTP for a mobile"""
        try:
            # Send OTP
            send_payload = {"mobile": mobile}
            send_response = requests.post(f"{self.base_url}/otp/send", 
                                        json=send_payload,
                                        headers={'Content-Type': 'application/json'},
                                        timeout=10)
            
            if send_response.status_code != 200:
                return False
            
            # Wait and extract OTP
            time.sleep(1)
            actual_otp = self.get_otp_from_logs(mobile)
            
            if not actual_otp:
                return False
            
            # Verify OTP
            verify_payload = {"mobile": mobile, "otp": actual_otp}
            verify_response = requests.post(f"{self.base_url}/otp/verify", 
                                          json=verify_payload,
                                          headers={'Content-Type': 'application/json'},
                                          timeout=10)
            
            if verify_response.status_code != 200:
                return False
            
            verify_data = verify_response.json()
            return verify_data.get("verified") == True
            
        except:
            return False
    
    def test_otp_verification_with_failed_pre_entry(self):
        """
        Test Case 4: OTP verification followed by failed pre-entry creation
        Tests edge case where OTP is verified but pre-entry creation fails
        """
        print("🔍 Testing OTP Verification with Failed Pre-Entry...")
        
        mobile = self.test_mobile_edge
        
        try:
            # First verify OTP
            if not self.send_and_verify_otp(mobile):
                self.log_test("OTP with Failed Pre-Entry", False, "OTP verification failed")
                return False
            
            # Try to create pre-entry with invalid item_id (should fail)
            pre_entry_payload = {
                "transaction_type": "farmer_purchase",
                "from_location": "Test Warehouse",
                "party_type": "farmer",
                "party_name": "Test Farmer Edge Case",
                "party_mobile": mobile,
                "item_id": "invalid-item-id",  # This should cause failure
                "rate_per_qtl": 2500.0,
                "created_by": "test_user"
            }
            
            pre_entry_response = requests.post(f"{self.base_url}/pre-entry", 
                                             json=pre_entry_payload,
                                             headers={'Content-Type': 'application/json'},
                                             timeout=10)
            
            # Pre-entry should fail
            if pre_entry_response.status_code == 200:
                self.log_test("OTP with Failed Pre-Entry", False, 
                            "Pre-entry should have failed with invalid item_id")
                return False
            
            # Now try with valid item_id - farmer should still be created with verification status
            pre_entry_payload["item_id"] = self.test_item_id
            
            pre_entry_response = requests.post(f"{self.base_url}/pre-entry", 
                                             json=pre_entry_payload,
                                             headers={'Content-Type': 'application/json'},
                                             timeout=10)
            
            if pre_entry_response.status_code != 200:
                self.log_test("OTP with Failed Pre-Entry", False, 
                            f"Second pre-entry creation failed: HTTP {pre_entry_response.status_code}")
                return False
            
            # Verify farmer was created with verification status preserved
            farmer_response = requests.get(f"{self.base_url}/farmer/{mobile}", timeout=10)
            
            if farmer_response.status_code != 200:
                self.log_test("OTP with Failed Pre-Entry", False, 
                            f"Failed to get farmer: HTTP {farmer_response.status_code}")
                return False
            
            farmer_data = farmer_response.json()
            mobile_verified = farmer_data.get('mobile_verified')
            
            if mobile_verified == True:
                self.log_test("OTP with Failed Pre-Entry", True, 
                            f"✅ OTP verification status preserved even after failed pre-entry attempt")
                return True
            else:
                self.log_test("OTP with Failed Pre-Entry", False, 
                            f"❌ Verification status lost: mobile_verified={mobile_verified}")
                return False
                
        except Exception as e:
            self.log_test("OTP with Failed Pre-Entry", False, f"Test failed: {str(e)}")
            return False
    
    def test_farmer_model_verification_fields(self):
        """
        Test Case 5: Verify farmer model has all required verification fields
        """
        print("🔍 Testing Farmer Model Verification Fields...")
        
        try:
            # Get farmers list to check model structure
            response = requests.get(f"{self.base_url}/farmers", timeout=10)
            
            if response.status_code == 200:
                farmers = response.json()
                
                if isinstance(farmers, list) and len(farmers) > 0:
                    sample_farmer = farmers[0]
                    
                    # Check for mobile verification fields
                    verification_fields = ["mobile_verified", "mobile_verified_at", "otp_verified_count"]
                    present_fields = [field for field in verification_fields if field in sample_farmer]
                    
                    if len(present_fields) == len(verification_fields):
                        self.log_test("Farmer Model Verification Fields", True, 
                                    f"✅ All verification fields present: {present_fields}")
                        return True
                    else:
                        missing = [field for field in verification_fields if field not in sample_farmer]
                        self.log_test("Farmer Model Verification Fields", False, 
                                    f"❌ Missing verification fields: {missing}")
                        return False
                else:
                    self.log_test("Farmer Model Verification Fields", True, 
                                "No farmers in database - cannot verify model structure (acceptable)")
                    return True
            else:
                self.log_test("Farmer Model Verification Fields", False, 
                            f"Failed to get farmers: HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Farmer Model Verification Fields", False, f"Request failed: {str(e)}")
            return False
    
    def test_verification_status_check_endpoints(self):
        """
        Test Case 6: Test verification status check endpoints
        """
        print("🔍 Testing Verification Status Check Endpoints...")
        
        try:
            # Test with a mobile that should require OTP
            test_mobile = "9999888777"
            response = requests.get(f"{self.base_url}/otp/check-verification/{test_mobile}", 
                                  timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                required_fields = ["mobile", "farmer_exists", "verified", "requires_otp"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    if (data.get("farmer_exists") == False and 
                        data.get("verified") == False and 
                        data.get("requires_otp") == True):
                        
                        self.log_test("Verification Status Check", True, 
                                    f"✅ New mobile {test_mobile} correctly requires OTP verification")
                        return True
                    else:
                        self.log_test("Verification Status Check", False, 
                                    f"❌ Unexpected verification status: {data}")
                        return False
                else:
                    self.log_test("Verification Status Check", False, f"Missing fields: {missing_fields}")
                    return False
            else:
                self.log_test("Verification Status Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Verification Status Check", False, f"Request failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all OTP-Farmer Integration tests"""
        print("🚀 Starting OTP-Farmer Integration Fix Testing")
        print(f"Testing against: {self.base_url}")
        print("=" * 80)
        
        # Setup test data first
        if not self.setup_test_data():
            print("❌ Test setup failed. Cannot proceed with testing.")
            return False
        
        print("\n" + "=" * 80)
        print("🔥 CRITICAL INTEGRATION TESTS")
        print("=" * 80)
        
        # Test 1: Complete integration flow (MOST IMPORTANT)
        self.test_complete_integration_flow()
        
        print("\n" + "=" * 80)
        print("📋 VERIFICATION STATUS PRESERVATION TESTS")
        print("=" * 80)
        
        # Test 2: Pre-entry without OTP verification
        self.test_pre_entry_without_otp_verification()
        
        print("\n" + "=" * 80)
        print("📋 EDGE CASE TESTS")
        print("=" * 80)
        
        # Test 3: Multiple OTP verifications
        self.test_multiple_otp_verifications_before_farmer_creation()
        
        # Test 4: Failed pre-entry scenarios
        self.test_otp_verification_with_failed_pre_entry()
        
        print("\n" + "=" * 80)
        print("📋 MODEL AND ENDPOINT VALIDATION")
        print("=" * 80)
        
        # Test 5: Farmer model verification fields
        self.test_farmer_model_verification_fields()
        
        # Test 6: Verification status endpoints
        self.test_verification_status_check_endpoints()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 OTP-FARMER INTEGRATION TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Detailed results
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
            
            print("\n🚨 CRITICAL INTEGRATION ISSUES FOUND:")
            print("The OTP-Farmer integration fix may not be working correctly.")
            print("Please review the failed tests above and check the implementation.")
        else:
            print("\n🎉 ALL INTEGRATION TESTS PASSED!")
            print("✅ OTP verification status is correctly preserved during farmer creation")
            print("✅ The critical integration gap has been resolved")
        
        print("\n" + "=" * 80)
        return failed_tests == 0

if __name__ == "__main__":
    tester = OTPFarmerIntegrationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)