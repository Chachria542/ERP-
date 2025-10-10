#!/usr/bin/env python3
"""
Backend API Testing for Farmer Payment Queue Module
Tests NEW farmer payment queue endpoints and functionality
"""
import requests
import json
import sys
from datetime import datetime, timezone, timedelta

# Backend URL from frontend/.env
BASE_URL = "https://farmers-ledger.preview.emergentagent.com/api"

class FarmerPaymentQueueTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.test_slip_id = None
        self.created_payment_id = None
        
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
        """Create test weighbridge entry for queue testing"""
        print("🔧 Setting up test data...")
        
        # First create a pre-entry
        try:
            pre_entry_data = {
                "transaction_type": "farmer_purchase",
                "party_type": "farmer",
                "party_name": "Test Farmer E2E",
                "party_mobile": "9999111222",
                "party_city": "Test City",
                "item_name": "Wheat",
                "rate_per_qtl": 2500.0,
                "bags_expected": 50,
                "created_by_id": "test_user",
                "created_by_name": "Test User"
            }
            
            response = requests.post(f"{self.base_url}/pre-entry", 
                                   json=pre_entry_data,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 200:
                pre_entry = response.json()
                self.test_slip_id = pre_entry.get('slip_id')
                self.log_test("Pre-Entry Creation", True, f"Created pre-entry with slip_id: {self.test_slip_id}")
                
                # Now create weighbridge entry
                wb_entry_data = {
                    "slip_id": self.test_slip_id,
                    "vehicle_number": "MP09TEST999",
                    "vehicle_type": "Truck",
                    "driver_name": "Test Driver",
                    "gross_weight": 15000.0,
                    "tare_weight": 10000.0,
                    "operator_id": "test_operator",
                    "operator_name": "Test Operator"
                }
                
                wb_response = requests.post(f"{self.base_url}/weighbridge-entry",
                                          json=wb_entry_data,
                                          headers={'Content-Type': 'application/json'},
                                          timeout=10)
                
                if wb_response.status_code == 200:
                    self.log_test("Weighbridge Entry Creation", True, f"Created weighbridge entry for slip: {self.test_slip_id}")
                    return True
                else:
                    self.log_test("Weighbridge Entry Creation", False, f"HTTP {wb_response.status_code}: {wb_response.text}")
                    return False
            else:
                self.log_test("Pre-Entry Creation", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Test Data Setup", False, f"Request failed: {str(e)}")
            return False
    
    def test_queue_default(self):
        """Test Case 1: Default queue (all pending)"""
        print("🔍 Testing Queue Endpoint - Default (All Pending)...")
        
        try:
            response = requests.get(f"{self.base_url}/farmer-payment/queue", timeout=10)
            
            if response.status_code == 200:
                queue_items = response.json()
                
                if isinstance(queue_items, list):
                    # Check if our test slip is in the queue
                    test_slip_found = False
                    if self.test_slip_id:
                        test_slip_found = any(item.get('slip_id') == self.test_slip_id for item in queue_items)
                    
                    # Verify response structure for each item
                    if queue_items:
                        sample_item = queue_items[0]
                        required_fields = [
                            'slip_id', 'farmer_name', 'farmer_mobile', 'item_name', 
                            'act_qtl', 'vehicle_type', 'rate_per_qtl', 'estimated_amount',
                            'payment_status', 'created_at', 'weighed_at'
                        ]
                        
                        missing_fields = [field for field in required_fields if field not in sample_item]
                        
                        if not missing_fields:
                            self.log_test("Queue Default", True, 
                                        f"Found {len(queue_items)} pending items. Test slip found: {test_slip_found}")
                        else:
                            self.log_test("Queue Default", False, 
                                        f"Missing fields in response: {missing_fields}", sample_item)
                    else:
                        self.log_test("Queue Default", True, "Empty queue (valid response)")
                else:
                    self.log_test("Queue Default", False, f"Expected list, got {type(queue_items)}")
            else:
                self.log_test("Queue Default", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Queue Default", False, f"Request failed: {str(e)}")
    
    def test_queue_search_slip_id(self):
        """Test Case 2: Search by slip ID"""
        print("🔍 Testing Queue Endpoint - Search by Slip ID...")
        
        if not self.test_slip_id:
            self.log_test("Queue Search - Slip ID", False, "No test slip ID available")
            return
        
        try:
            response = requests.get(f"{self.base_url}/farmer-payment/queue?search={self.test_slip_id}", timeout=10)
            
            if response.status_code == 200:
                queue_items = response.json()
                
                if isinstance(queue_items, list):
                    if len(queue_items) == 1 and queue_items[0].get('slip_id') == self.test_slip_id:
                        self.log_test("Queue Search - Slip ID", True, 
                                    f"Found exact match for slip ID: {self.test_slip_id}")
                    elif len(queue_items) == 0:
                        self.log_test("Queue Search - Slip ID", False, 
                                    f"No results found for slip ID: {self.test_slip_id}")
                    else:
                        self.log_test("Queue Search - Slip ID", False, 
                                    f"Expected 1 result, got {len(queue_items)}")
                else:
                    self.log_test("Queue Search - Slip ID", False, f"Expected list, got {type(queue_items)}")
            else:
                self.log_test("Queue Search - Slip ID", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Queue Search - Slip ID", False, f"Request failed: {str(e)}")
    
    def test_queue_search_farmer_name(self):
        """Test Case 3: Search by farmer name"""
        print("🔍 Testing Queue Endpoint - Search by Farmer Name...")
        
        try:
            response = requests.get(f"{self.base_url}/farmer-payment/queue?search=Test Farmer", timeout=10)
            
            if response.status_code == 200:
                queue_items = response.json()
                
                if isinstance(queue_items, list):
                    # Check if all results contain "Test Farmer" in name
                    valid_results = all('test farmer' in item.get('farmer_name', '').lower() 
                                      for item in queue_items)
                    
                    if valid_results:
                        self.log_test("Queue Search - Farmer Name", True, 
                                    f"Found {len(queue_items)} items matching 'Test Farmer'")
                    else:
                        self.log_test("Queue Search - Farmer Name", False, 
                                    "Some results don't match search criteria")
                else:
                    self.log_test("Queue Search - Farmer Name", False, f"Expected list, got {type(queue_items)}")
            else:
                self.log_test("Queue Search - Farmer Name", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Queue Search - Farmer Name", False, f"Request failed: {str(e)}")
    
    def test_queue_date_filter_today(self):
        """Test Case 4: Date filter - Today"""
        print("🔍 Testing Queue Endpoint - Date Filter (Today)...")
        
        try:
            response = requests.get(f"{self.base_url}/farmer-payment/queue?date_filter=today", timeout=10)
            
            if response.status_code == 200:
                queue_items = response.json()
                
                if isinstance(queue_items, list):
                    # Check if all items are from today
                    today = datetime.now(timezone.utc).date()
                    valid_dates = True
                    
                    for item in queue_items:
                        created_at = item.get('created_at', '')
                        if created_at:
                            try:
                                item_date = datetime.fromisoformat(created_at.replace('Z', '+00:00')).date()
                                if item_date != today:
                                    valid_dates = False
                                    break
                            except:
                                pass  # Skip invalid dates
                    
                    if valid_dates:
                        self.log_test("Queue Date Filter - Today", True, 
                                    f"Found {len(queue_items)} items from today")
                    else:
                        self.log_test("Queue Date Filter - Today", False, 
                                    "Some items are not from today")
                else:
                    self.log_test("Queue Date Filter - Today", False, f"Expected list, got {type(queue_items)}")
            else:
                self.log_test("Queue Date Filter - Today", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Queue Date Filter - Today", False, f"Request failed: {str(e)}")
    
    def test_queue_sort_by_amount(self):
        """Test Case 5: Sort by amount"""
        print("🔍 Testing Queue Endpoint - Sort by Amount (Descending)...")
        
        try:
            response = requests.get(f"{self.base_url}/farmer-payment/queue?sort_by=amount&sort_order=desc", timeout=10)
            
            if response.status_code == 200:
                queue_items = response.json()
                
                if isinstance(queue_items, list) and len(queue_items) > 1:
                    # Check if sorted by estimated_amount descending
                    amounts = [item.get('estimated_amount', 0) for item in queue_items]
                    is_sorted = all(amounts[i] >= amounts[i+1] for i in range(len(amounts)-1))
                    
                    if is_sorted:
                        self.log_test("Queue Sort - Amount Desc", True, 
                                    f"Items correctly sorted by amount (highest: ₹{amounts[0]}, lowest: ₹{amounts[-1]})")
                    else:
                        self.log_test("Queue Sort - Amount Desc", False, 
                                    f"Items not properly sorted. Amounts: {amounts[:5]}")
                elif len(queue_items) <= 1:
                    self.log_test("Queue Sort - Amount Desc", True, 
                                f"Sort test passed (only {len(queue_items)} items)")
                else:
                    self.log_test("Queue Sort - Amount Desc", False, f"Expected list, got {type(queue_items)}")
            else:
                self.log_test("Queue Sort - Amount Desc", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Queue Sort - Amount Desc", False, f"Request failed: {str(e)}")
    
    def test_update_payment_status_valid(self):
        """Test Case 1: Valid status update"""
        print("🔍 Testing Update Payment Status - Valid Status...")
        
        if not self.test_slip_id:
            self.log_test("Update Payment Status - Valid", False, "No test slip ID available")
            return
        
        try:
            payload = {"payment_status": "payment_completed"}
            response = requests.put(f"{self.base_url}/weighbridge-entry/{self.test_slip_id}/payment-status",
                                  json=payload,
                                  headers={'Content-Type': 'application/json'},
                                  timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                if (result.get('slip_id') == self.test_slip_id and 
                    result.get('payment_status') == 'payment_completed'):
                    self.log_test("Update Payment Status - Valid", True, 
                                f"Successfully updated status to payment_completed for {self.test_slip_id}")
                else:
                    self.log_test("Update Payment Status - Valid", False, 
                                f"Unexpected response: {result}")
            else:
                self.log_test("Update Payment Status - Valid", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Update Payment Status - Valid", False, f"Request failed: {str(e)}")
    
    def test_update_payment_status_invalid(self):
        """Test Case 2: Invalid status"""
        print("🔍 Testing Update Payment Status - Invalid Status...")
        
        if not self.test_slip_id:
            self.log_test("Update Payment Status - Invalid", False, "No test slip ID available")
            return
        
        try:
            payload = {"payment_status": "invalid_status"}
            response = requests.put(f"{self.base_url}/weighbridge-entry/{self.test_slip_id}/payment-status",
                                  json=payload,
                                  headers={'Content-Type': 'application/json'},
                                  timeout=10)
            
            if response.status_code == 400:
                self.log_test("Update Payment Status - Invalid", True, 
                            "Correctly rejected invalid status with 400 error")
            else:
                self.log_test("Update Payment Status - Invalid", False, 
                            f"Expected 400, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Update Payment Status - Invalid", False, f"Request failed: {str(e)}")
    
    def test_update_payment_status_nonexistent(self):
        """Test Case 3: Non-existent slip"""
        print("🔍 Testing Update Payment Status - Non-existent Slip...")
        
        try:
            payload = {"payment_status": "payment_completed"}
            response = requests.put(f"{self.base_url}/weighbridge-entry/WB-99-999999/payment-status",
                                  json=payload,
                                  headers={'Content-Type': 'application/json'},
                                  timeout=10)
            
            if response.status_code == 404:
                self.log_test("Update Payment Status - Non-existent", True, 
                            "Correctly returned 404 for non-existent slip")
            else:
                self.log_test("Update Payment Status - Non-existent", False, 
                            f"Expected 404, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Update Payment Status - Non-existent", False, f"Request failed: {str(e)}")
    
    def test_farmer_payment_creation_updates_status(self):
        """Test: Create farmer payment and verify weighbridge entry status changes"""
        print("🔍 Testing Farmer Payment Creation Updates Status...")
        
        if not self.test_slip_id:
            self.log_test("Farmer Payment Creation Updates Status", False, "No test slip ID available")
            return
        
        # First reset the payment status to pending
        try:
            reset_payload = {"payment_status": "pending_payment"}
            requests.put(f"{self.base_url}/weighbridge-entry/{self.test_slip_id}/payment-status",
                        json=reset_payload,
                        headers={'Content-Type': 'application/json'},
                        timeout=10)
        except:
            pass  # Ignore reset errors
        
        # Create farmer payment
        payment_payload = {
            "location": "Sanawad",
            "contract_type": "Anubandh",
            "mandi_godown": "Mandi",
            "date": "2025-01-10",
            "gate_entry_no": self.test_slip_id,
            "farmer_name": "Test Farmer E2E",
            "mobile": "9999111222",
            "city": "Test City",
            "token_no": "TK123",
            "lines": [{
                "item_name": "Wheat",
                "pack_kg": 100,
                "bags": 50,
                "rem_kg": 0,
                "act_kg": 5000,
                "act_qtl": 50.0,
                "rate_per_qtl": 2500,
                "item_amount": 125000,
                "vehicle_type": "Truck",
                "h_plus_t": 237.5,
                "line_total": 124762.5,
                "sort_order": 0
            }],
            "pay_type": "Cash",
            "cash_amt": 124762.5,
            "bank_amt": 0,
            "additional_hamli": 0,
            "bank_charges": 0,
            "created_by": "test_user_id"
        }
        
        try:
            response = requests.post(f"{self.base_url}/farmer-payment",
                                   json=payment_payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=15)
            
            if response.status_code == 200:
                payment_data = response.json()
                self.created_payment_id = payment_data.get('id')
                
                # Now check if the slip appears in queue (should be 0 results)
                queue_response = requests.get(f"{self.base_url}/farmer-payment/queue?search={self.test_slip_id}", timeout=10)
                
                if queue_response.status_code == 200:
                    queue_items = queue_response.json()
                    
                    if len(queue_items) == 0:
                        self.log_test("Farmer Payment Creation Updates Status", True, 
                                    f"Payment created and slip {self.test_slip_id} removed from queue (status updated to payment_completed)")
                    else:
                        self.log_test("Farmer Payment Creation Updates Status", False, 
                                    f"Slip still appears in queue after payment creation: {len(queue_items)} items")
                else:
                    self.log_test("Farmer Payment Creation Updates Status", False, 
                                f"Failed to check queue: HTTP {queue_response.status_code}")
            else:
                self.log_test("Farmer Payment Creation Updates Status", False, 
                            f"Payment creation failed: HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Farmer Payment Creation Updates Status", False, f"Request failed: {str(e)}")
    
    def test_queue_empty_after_completion(self):
        """Test Case 1: Empty queue after all payments completed"""
        print("🔍 Testing Queue - Empty Queue After Completion...")
        
        try:
            # Mark all slips as payment_completed
            queue_response = requests.get(f"{self.base_url}/farmer-payment/queue", timeout=10)
            
            if queue_response.status_code == 200:
                queue_items = queue_response.json()
                
                # Update all to payment_completed
                for item in queue_items:
                    slip_id = item.get('slip_id')
                    if slip_id:
                        try:
                            payload = {"payment_status": "payment_completed"}
                            requests.put(f"{self.base_url}/weighbridge-entry/{slip_id}/payment-status",
                                       json=payload,
                                       headers={'Content-Type': 'application/json'},
                                       timeout=5)
                        except:
                            pass  # Ignore individual failures
                
                # Now check if queue is empty
                empty_queue_response = requests.get(f"{self.base_url}/farmer-payment/queue", timeout=10)
                
                if empty_queue_response.status_code == 200:
                    empty_queue = empty_queue_response.json()
                    
                    if isinstance(empty_queue, list) and len(empty_queue) == 0:
                        self.log_test("Queue Empty After Completion", True, 
                                    "Queue correctly returns empty array [] when all payments completed")
                    else:
                        self.log_test("Queue Empty After Completion", False, 
                                    f"Expected empty array, got {len(empty_queue)} items")
                else:
                    self.log_test("Queue Empty After Completion", False, 
                                f"Failed to check empty queue: HTTP {empty_queue_response.status_code}")
            else:
                self.log_test("Queue Empty After Completion", False, 
                            f"Failed to get initial queue: HTTP {queue_response.status_code}")
                
        except Exception as e:
            self.log_test("Queue Empty After Completion", False, f"Request failed: {str(e)}")
    
    def test_queue_mixed_transaction_types(self):
        """Test Case 2: Mixed transaction types (should only show farmer_purchase)"""
        print("🔍 Testing Queue - Mixed Transaction Types...")
        
        # Create an internal_transfer pre-entry for testing
        try:
            internal_transfer_data = {
                "transaction_type": "internal_transfer",
                "party_type": "internal",
                "party_name": "Internal Transfer Test",
                "party_mobile": "8888888888",
                "item_name": "Wheat",
                "rate_per_qtl": 0,
                "bags_expected": 25,
                "created_by_id": "test_user",
                "created_by_name": "Test User"
            }
            
            response = requests.post(f"{self.base_url}/pre-entry",
                                   json=internal_transfer_data,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 200:
                internal_slip = response.json()
                internal_slip_id = internal_slip.get('slip_id')
                
                # Create weighbridge entry for internal transfer
                wb_entry_data = {
                    "slip_id": internal_slip_id,
                    "vehicle_number": "MP09INT999",
                    "vehicle_type": "Truck",
                    "gross_weight": 12000.0,
                    "tare_weight": 9500.0,
                    "operator_id": "test_operator",
                    "operator_name": "Test Operator"
                }
                
                wb_response = requests.post(f"{self.base_url}/weighbridge-entry",
                                          json=wb_entry_data,
                                          headers={'Content-Type': 'application/json'},
                                          timeout=10)
                
                if wb_response.status_code == 200:
                    # Now check queue - should NOT include internal_transfer
                    queue_response = requests.get(f"{self.base_url}/farmer-payment/queue", timeout=10)
                    
                    if queue_response.status_code == 200:
                        queue_items = queue_response.json()
                        
                        # Check that no internal_transfer items are in queue
                        internal_found = any(item.get('slip_id') == internal_slip_id for item in queue_items)
                        
                        if not internal_found:
                            self.log_test("Queue Mixed Transaction Types", True, 
                                        f"Queue correctly excludes internal_transfer items. Found {len(queue_items)} farmer_purchase items only")
                        else:
                            self.log_test("Queue Mixed Transaction Types", False, 
                                        "Queue incorrectly includes internal_transfer items")
                    else:
                        self.log_test("Queue Mixed Transaction Types", False, 
                                    f"Failed to check queue: HTTP {queue_response.status_code}")
                else:
                    self.log_test("Queue Mixed Transaction Types", False, 
                                f"Failed to create internal transfer weighbridge entry: HTTP {wb_response.status_code}")
            else:
                self.log_test("Queue Mixed Transaction Types", False, 
                            f"Failed to create internal transfer pre-entry: HTTP {response.status_code}")
                
        except Exception as e:
            self.log_test("Queue Mixed Transaction Types", False, f"Request failed: {str(e)}")
    
    def test_edge_cases(self):
        """Test edge cases"""
        print("🔍 Testing Edge Cases...")
        
        # Test invalid item_id in payment creation
        invalid_payload = {
            "location": "Sanawad",
            "contract_type": "Anubandh", 
            "mandi_godown": "Mandi",
            "date": "2025-01-10",
            "farmer_name": "Test Farmer",
            "mobile": "9876543210",
            "lines": [{
                "item_id": "invalid-item-id",
                "item_name": "Invalid Item",
                "pack_kg": 100,
                "bags": 10,
                "rem_kg": 0,
                "act_kg": 1000,
                "act_qtl": 10.0,
                "rate_per_qtl": 2500,
                "item_amount": 25000,
                "vehicle_type": "Truck",
                "h_plus_t": 47.5,
                "line_total": 24952.5,
                "sort_order": 0
            }],
            "pay_type": "Cash",
            "cash_amt": 24952.5,
            "bank_amt": 0,
            "additional_hamli": 0,
            "bank_charges": 0,
            "created_by": "test_user_id"
        }
        
        try:
            response = requests.post(f"{self.base_url}/farmer-payment",
                                   json=invalid_payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code in [400, 404, 422]:
                self.log_test("Edge Case - Invalid Item ID", True, "Correctly rejected invalid item_id")
            else:
                self.log_test("Edge Case - Invalid Item ID", False, f"Expected error, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Edge Case - Invalid Item ID", False, f"Request failed: {str(e)}")
        
        # Test missing required fields
        minimal_payload = {
            "location": "Sanawad"
        }
        
        try:
            response = requests.post(f"{self.base_url}/farmer-payment",
                                   json=minimal_payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code in [400, 422]:
                self.log_test("Edge Case - Missing Required Fields", True, "Correctly rejected incomplete payload")
            else:
                self.log_test("Edge Case - Missing Required Fields", False, f"Expected error, got {response.status_code}")
                
        except Exception as e:
            self.log_test("Edge Case - Missing Required Fields", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Farmer Payment Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Run tests in order
        self.test_items_endpoint()
        self.test_weighbridge_slip_fetch()
        self.test_book_number_generation()
        self.test_farmer_payment_creation()
        self.test_farmer_payments_list()
        self.test_edge_cases()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
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
        
        print("\n" + "=" * 60)
        return failed_tests == 0

if __name__ == "__main__":
    tester = FarmerPaymentTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)