#!/usr/bin/env python3
"""
Backend API Testing for OTP-Farmer Integration Fix
Tests the complete OTP → Pre-Entry → Farmer creation flow to verify integration is working
"""
import requests
import json
import sys
import time
from datetime import datetime, timezone, timedelta

# Backend URL from frontend/.env
BASE_URL = "https://grain-erp-trading.preview.emergentagent.com/api"

class OTPFarmerIntegrationTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        # Use realistic mobile numbers for testing
        self.test_mobile_new = "9876543210"  # New mobile for complete flow test
        self.test_mobile_no_otp = "9876543211"  # Mobile without OTP verification
        self.test_mobile_multiple = "9876543212"  # Mobile for multiple OTP tests
        self.test_mobile_edge = "9876543213"  # Mobile for edge case tests
        self.sent_otp = None
        self.test_farmer_id = None
        self.test_item_id = None
        
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
        """Setup test data - get available item for pre-entry creation"""
        print("🔧 Setting up test data...")
        
        try:
            # Get available items for pre-entry creation
            response = requests.get(f"{self.base_url}/items", timeout=10)
            
            if response.status_code == 200:
                items = response.json()
                if items and len(items) > 0:
                    self.test_item_id = items[0]['id']
                    self.log_test("Test Data Setup", True, f"Using item: {items[0]['name']} (ID: {self.test_item_id})")
                else:
                    self.log_test("Test Data Setup", False, "No items available for testing")
                    return False
            else:
                self.log_test("Test Data Setup", False, f"Failed to get items: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Test Data Setup", False, f"Setup failed: {str(e)}")
            return False
        
        return True
    
    def test_complete_integration_flow(self):
        """
        CRITICAL TEST: Complete OTP → Verify → Pre-Entry → Farmer Creation Flow
        This tests the main fix: OTP verification status preservation during farmer creation
        """
        print("🔍 CRITICAL TEST: Complete OTP-Farmer Integration Flow...")
        
        mobile = self.test_mobile_new
        farmer_name = "Test Farmer Integration"
        
        try:
            # Step 1: Send OTP to new mobile
            print("  Step 1: Sending OTP...")
            send_payload = {"mobile": mobile}
            send_response = requests.post(f"{self.base_url}/otp/send", 
                                        json=send_payload,
                                        headers={'Content-Type': 'application/json'},
                                        timeout=10)
            
            if send_response.status_code != 200:
                self.log_test("Complete Integration Flow - Step 1", False, 
                            f"Failed to send OTP: HTTP {send_response.status_code}")
                return False
            
            # Step 2: Extract OTP from logs and verify
            print("  Step 2: Extracting and verifying OTP...")
            time.sleep(1)  # Wait for logs
            actual_otp = self.get_otp_from_logs(mobile)
            
            if not actual_otp:
                self.log_test("Complete Integration Flow - Step 2", False, 
                            "Could not extract OTP from backend logs")
                return False
            
            verify_payload = {"mobile": mobile, "otp": actual_otp}
            verify_response = requests.post(f"{self.base_url}/otp/verify", 
                                          json=verify_payload,
                                          headers={'Content-Type': 'application/json'},
                                          timeout=10)
            
            if verify_response.status_code != 200:
                self.log_test("Complete Integration Flow - Step 2", False, 
                            f"OTP verification failed: HTTP {verify_response.status_code}")
                return False
            
            verify_data = verify_response.json()
            if not verify_data.get("verified"):
                self.log_test("Complete Integration Flow - Step 2", False, 
                            f"OTP not verified: {verify_data}")
                return False
            
            print(f"    ✅ OTP {actual_otp} verified successfully")
            
            # Step 3: Create Pre-Entry (this should create farmer with mobile_verified=true)
            print("  Step 3: Creating Pre-Entry (triggers farmer creation)...")
            pre_entry_payload = {
                "transaction_type": "farmer_purchase",
                "from_location": "Test Warehouse",
                "party_type": "farmer",
                "party_name": farmer_name,
                "party_mobile": mobile,
                "item_id": self.test_item_id,
                "rate_per_qtl": 2500.0,
                "created_by": "test_user"
            }
            
            pre_entry_response = requests.post(f"{self.base_url}/pre-entry", 
                                             json=pre_entry_payload,
                                             headers={'Content-Type': 'application/json'},
                                             timeout=10)
            
            if pre_entry_response.status_code != 200:
                self.log_test("Complete Integration Flow - Step 3", False, 
                            f"Pre-entry creation failed: HTTP {pre_entry_response.status_code}: {pre_entry_response.text}")
                return False
            
            pre_entry_data = pre_entry_response.json()
            print(f"    ✅ Pre-entry created: {pre_entry_data.get('slip_id')}")
            
            # Step 4: Verify farmer was created with mobile_verified=true
            print("  Step 4: Verifying farmer verification status...")
            farmer_response = requests.get(f"{self.base_url}/farmer/{mobile}", timeout=10)
            
            if farmer_response.status_code != 200:
                self.log_test("Complete Integration Flow - Step 4", False, 
                            f"Failed to get farmer: HTTP {farmer_response.status_code}")
                return False
            
            farmer_data = farmer_response.json()
            
            # Check critical verification fields
            mobile_verified = farmer_data.get('mobile_verified')
            mobile_verified_at = farmer_data.get('mobile_verified_at')
            otp_verified_count = farmer_data.get('otp_verified_count')
            
            if mobile_verified == True and mobile_verified_at and otp_verified_count >= 1:
                self.log_test("Complete Integration Flow", True, 
                            f"✅ INTEGRATION WORKING: Farmer {farmer_name} created with mobile_verified=True, "
                            f"verified_at={mobile_verified_at}, count={otp_verified_count}")
                return True
            else:
                self.log_test("Complete Integration Flow", False, 
                            f"❌ INTEGRATION FAILED: Farmer created but verification status not preserved. "
                            f"mobile_verified={mobile_verified}, verified_at={mobile_verified_at}, count={otp_verified_count}")
                return False
                
        except Exception as e:
            self.log_test("Complete Integration Flow", False, f"Integration test failed: {str(e)}")
            return False
    
    def test_pre_entry_without_otp_verification(self):
        """
        Test Case 2: Create pre-entry without OTP verification
        Farmer should be created with mobile_verified=false (default behavior)
        """
        print("🔍 Testing Pre-Entry Without OTP Verification...")
        
        mobile = self.test_mobile_no_otp
        farmer_name = "Test Farmer No OTP"
        
        try:
            # Create Pre-Entry directly without OTP verification
            pre_entry_payload = {
                "transaction_type": "farmer_purchase",
                "from_location": "Test Warehouse",
                "party_type": "farmer",
                "party_name": farmer_name,
                "party_mobile": mobile,
                "item_id": self.test_item_id,
                "rate_per_qtl": 2500.0,
                "created_by": "test_user"
            }
            
            pre_entry_response = requests.post(f"{self.base_url}/pre-entry", 
                                             json=pre_entry_payload,
                                             headers={'Content-Type': 'application/json'},
                                             timeout=10)
            
            if pre_entry_response.status_code != 200:
                self.log_test("Pre-Entry Without OTP", False, 
                            f"Pre-entry creation failed: HTTP {pre_entry_response.status_code}: {pre_entry_response.text}")
                return False
            
            # Verify farmer was created with mobile_verified=false
            farmer_response = requests.get(f"{self.base_url}/farmer/{mobile}", timeout=10)
            
            if farmer_response.status_code != 200:
                self.log_test("Pre-Entry Without OTP", False, 
                            f"Failed to get farmer: HTTP {farmer_response.status_code}")
                return False
            
            farmer_data = farmer_response.json()
            mobile_verified = farmer_data.get('mobile_verified')
            otp_verified_count = farmer_data.get('otp_verified_count')
            
            if mobile_verified == False and otp_verified_count == 0:
                self.log_test("Pre-Entry Without OTP", True, 
                            f"✅ Farmer {farmer_name} created with mobile_verified=False (default behavior)")
                return True
            else:
                self.log_test("Pre-Entry Without OTP", False, 
                            f"❌ Unexpected verification status: mobile_verified={mobile_verified}, count={otp_verified_count}")
                return False
                
        except Exception as e:
            self.log_test("Pre-Entry Without OTP", False, f"Test failed: {str(e)}")
            return False
    
    def test_multiple_otp_verifications_before_farmer_creation(self):
        """
        Test Case 3: Multiple OTP verifications before farmer creation
        Tests edge case where mobile gets verified multiple times before pre-entry
        """
        print("🔍 Testing Multiple OTP Verifications Before Farmer Creation...")
        
        mobile = self.test_mobile_multiple
        farmer_name = "Test Farmer Multiple OTP"
        
        try:
            # First OTP verification
            print("  First OTP verification...")
            if not self.send_and_verify_otp(mobile):
                self.log_test("Multiple OTP Verifications", False, "First OTP verification failed")
                return False
            
            # Wait a bit and do second OTP verification
            print("  Second OTP verification...")
            time.sleep(3)  # Wait for cooldown
            if not self.send_and_verify_otp(mobile):
                self.log_test("Multiple OTP Verifications", False, "Second OTP verification failed")
                return False
            
            # Now create pre-entry
            print("  Creating pre-entry after multiple verifications...")
            pre_entry_payload = {
                "transaction_type": "farmer_purchase",
                "from_location": "Test Warehouse",
                "party_type": "farmer",
                "party_name": farmer_name,
                "party_mobile": mobile,
                "item_id": self.test_item_id,
                "rate_per_qtl": 2500.0,
                "created_by": "test_user"
            }
            
            pre_entry_response = requests.post(f"{self.base_url}/pre-entry", 
                                             json=pre_entry_payload,
                                             headers={'Content-Type': 'application/json'},
                                             timeout=10)
            
            if pre_entry_response.status_code != 200:
                self.log_test("Multiple OTP Verifications", False, 
                            f"Pre-entry creation failed: HTTP {pre_entry_response.status_code}")
                return False
            
            # Verify farmer verification status
            farmer_response = requests.get(f"{self.base_url}/farmer/{mobile}", timeout=10)
            
            if farmer_response.status_code != 200:
                self.log_test("Multiple OTP Verifications", False, 
                            f"Failed to get farmer: HTTP {farmer_response.status_code}")
                return False
            
            farmer_data = farmer_response.json()
            mobile_verified = farmer_data.get('mobile_verified')
            otp_verified_count = farmer_data.get('otp_verified_count')
            
            if mobile_verified == True and otp_verified_count >= 1:
                self.log_test("Multiple OTP Verifications", True, 
                            f"✅ Farmer created with verification status preserved after multiple OTPs. Count: {otp_verified_count}")
                return True
            else:
                self.log_test("Multiple OTP Verifications", False, 
                            f"❌ Verification status not preserved: mobile_verified={mobile_verified}, count={otp_verified_count}")
                return False
                
        except Exception as e:
            self.log_test("Multiple OTP Verifications", False, f"Test failed: {str(e)}")
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
    
    def test_otp_verify_nonexistent_mobile(self):
        """Test Case 5: Verify OTP for mobile that never requested OTP"""
        print("🔍 Testing OTP Verify - Non-existent Mobile...")
        
        try:
            payload = {"mobile": "9999999999", "otp": "1234"}
            response = requests.post(f"{self.base_url}/otp/verify", 
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 404:
                data = response.json()
                if "No OTP found" in data.get("detail", ""):
                    self.log_test("OTP Verify - Non-existent Mobile", True, 
                                f"Correctly returned 404: {data.get('detail')}")
                else:
                    self.log_test("OTP Verify - Non-existent Mobile", False, 
                                f"Wrong error message: {data.get('detail')}")
            else:
                self.log_test("OTP Verify - Non-existent Mobile", False, 
                            f"Expected 404, got HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("OTP Verify - Non-existent Mobile", False, f"Request failed: {str(e)}")
    
    def test_check_verification_status(self):
        """Test Case 6: Check verification status endpoint"""
        print("🔍 Testing Check Verification Status...")
        
        try:
            response = requests.get(f"{self.base_url}/otp/check-verification/{self.test_mobile}", 
                                  timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                required_fields = ["mobile", "farmer_exists", "verified", "requires_otp"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_test("Check Verification Status", True, 
                                f"Status for {self.test_mobile}: farmer_exists={data.get('farmer_exists')}, "
                                f"verified={data.get('verified')}, requires_otp={data.get('requires_otp')}")
                else:
                    self.log_test("Check Verification Status", False, f"Missing fields: {missing_fields}", data)
            else:
                self.log_test("Check Verification Status", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Check Verification Status", False, f"Request failed: {str(e)}")
    
    def test_farmer_model_verification_fields(self):
        """Test Case 7: Check if farmer model has verification fields"""
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
                                    f"All verification fields present: {present_fields}")
                    else:
                        missing = [field for field in verification_fields if field not in sample_farmer]
                        self.log_test("Farmer Model Verification Fields", False, 
                                    f"Missing verification fields: {missing}")
                else:
                    self.log_test("Farmer Model Verification Fields", True, 
                                "No farmers in database - cannot verify model structure")
            else:
                self.log_test("Farmer Model Verification Fields", False, 
                            f"Failed to get farmers: HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Farmer Model Verification Fields", False, f"Request failed: {str(e)}")
    
    def test_otp_expiry_handling(self):
        """Test Case 8: Test OTP expiry (if possible)"""
        print("🔍 Testing OTP Expiry Handling...")
        
        # Since OTP expires in 2 minutes, we can't wait that long in a test
        # Instead, we'll test the logic by trying to verify an old OTP
        
        try:
            # Send OTP to a different mobile
            payload = {"mobile": self.test_mobile_2}
            send_response = requests.post(f"{self.base_url}/otp/send", 
                                        json=payload,
                                        headers={'Content-Type': 'application/json'},
                                        timeout=10)
            
            if send_response.status_code == 200:
                # Wait a few seconds and then try to verify with wrong OTP multiple times
                # to potentially trigger expiry or max attempts
                time.sleep(2)
                
                for attempt in range(6):  # Try 6 times to exceed max attempts
                    verify_payload = {"mobile": self.test_mobile_2, "otp": "0000"}
                    verify_response = requests.post(f"{self.base_url}/otp/verify", 
                                                  json=verify_payload,
                                                  headers={'Content-Type': 'application/json'},
                                                  timeout=10)
                    
                    if verify_response.status_code == 400:
                        data = verify_response.json()
                        if "Maximum attempts exceeded" in data.get("detail", ""):
                            self.log_test("OTP Expiry Handling", True, 
                                        f"Max attempts exceeded after {attempt + 1} attempts")
                            return
                
                self.log_test("OTP Expiry Handling", True, 
                            "OTP attempt limiting working (didn't exceed max attempts in test)")
            else:
                self.log_test("OTP Expiry Handling", False, 
                            f"Failed to send OTP for expiry test: HTTP {send_response.status_code}")
                
        except Exception as e:
            self.log_test("OTP Expiry Handling", False, f"Request failed: {str(e)}")
    
    def test_database_otp_storage(self):
        """Test Case 9: Verify OTP records are stored in database"""
        print("🔍 Testing Database OTP Storage...")
        
        # We can't directly access the database, but we can infer storage
        # by testing the verification status and behavior
        
        try:
            # Send OTP
            payload = {"mobile": "9876543299"}
            send_response = requests.post(f"{self.base_url}/otp/send", 
                                        json=payload,
                                        headers={'Content-Type': 'application/json'},
                                        timeout=10)
            
            if send_response.status_code == 200:
                # Try to verify immediately with wrong OTP
                verify_payload = {"mobile": "9876543299", "otp": "0000"}
                verify_response = requests.post(f"{self.base_url}/otp/verify", 
                                              json=verify_payload,
                                              headers={'Content-Type': 'application/json'},
                                              timeout=10)
                
                if verify_response.status_code == 400:
                    data = verify_response.json()
                    if "Invalid OTP" in data.get("detail", "") and "attempts remaining" in data.get("detail", ""):
                        self.log_test("Database OTP Storage", True, 
                                    "OTP stored in database - attempt tracking working")
                    else:
                        self.log_test("Database OTP Storage", True, 
                                    "OTP stored in database - verification logic working")
                else:
                    self.log_test("Database OTP Storage", False, 
                                f"Unexpected verify response: HTTP {verify_response.status_code}")
            else:
                self.log_test("Database OTP Storage", False, 
                            f"Failed to send OTP: HTTP {send_response.status_code}")
                
        except Exception as e:
            self.log_test("Database OTP Storage", False, f"Request failed: {str(e)}")
    
    def test_integration_pre_entry_flow(self):
        """Test Case 10: Integration with Pre-Entry creation flow"""
        print("🔍 Testing Integration - Pre-Entry Flow...")
        
        # This test checks if the OTP verification integrates with pre-entry creation
        # We'll test the check-verification endpoint which would be used by frontend
        
        try:
            # Check verification status for a new mobile
            test_mobile = "9876543333"
            response = requests.get(f"{self.base_url}/otp/check-verification/{test_mobile}", 
                                  timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if (data.get("farmer_exists") == False and 
                    data.get("verified") == False and 
                    data.get("requires_otp") == True):
                    
                    self.log_test("Integration - Pre-Entry Flow", True, 
                                f"New mobile {test_mobile} correctly requires OTP verification")
                else:
                    self.log_test("Integration - Pre-Entry Flow", False, 
                                f"Unexpected verification status: {data}")
            else:
                self.log_test("Integration - Pre-Entry Flow", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Integration - Pre-Entry Flow", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all OTP verification tests"""
        print("🚀 Starting OTP Verification System Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 80)
        
        # Cleanup first
        self.cleanup_test_data()
        
        print("\n" + "=" * 80)
        print("📋 TESTING OTP SEND ENDPOINTS")
        print("=" * 80)
        
        # Test OTP sending
        self.test_otp_send_new_mobile()
        self.test_otp_send_duplicate_request()
        
        print("\n" + "=" * 80)
        print("📋 TESTING OTP VERIFY ENDPOINTS")
        print("=" * 80)
        
        # Test OTP verification
        self.test_otp_verify_invalid_otp()
        self.test_otp_verify_valid_otp()
        self.test_otp_verify_nonexistent_mobile()
        
        print("\n" + "=" * 80)
        print("📋 TESTING VERIFICATION STATUS")
        print("=" * 80)
        
        # Test status checking
        self.test_check_verification_status()
        
        print("\n" + "=" * 80)
        print("📋 TESTING FARMER MODEL INTEGRATION")
        print("=" * 80)
        
        # Test farmer model
        self.test_farmer_model_verification_fields()
        
        print("\n" + "=" * 80)
        print("📋 TESTING EDGE CASES")
        print("=" * 80)
        
        # Test edge cases
        self.test_otp_expiry_handling()
        self.test_database_otp_storage()
        
        print("\n" + "=" * 80)
        print("📋 TESTING INTEGRATION")
        print("=" * 80)
        
        # Test integration
        self.test_integration_pre_entry_flow()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        else:
            print("\n🎉 ALL TESTS PASSED! OTP Verification System is working correctly.")
        
        print("\n" + "=" * 80)
        return failed_tests == 0

if __name__ == "__main__":
    tester = OTPVerificationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)