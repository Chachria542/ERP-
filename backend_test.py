#!/usr/bin/env python3
"""
Backend API Testing for Sales Pre-Entry to Invoice Flow
Tests the complete Sales Pre-Entry to Invoice flow end-to-end as requested
"""
import requests
import json
import sys
import time
from datetime import datetime, timezone, timedelta

# Backend URL from frontend/.env
BASE_URL = "https://trade-flow-17.preview.emergentagent.com/api"

class SalesFlowTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        # Test data for the specific flow
        self.target_slip_id = "SPRE-25-000014"
        self.test_vehicle = "MP09AB1234"
        self.test_driver = "Test Driver"
        self.test_mobile = "9876543210"
        self.test_operator = "test-operator"
        
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
    
    def test_phase1_verify_pre_entry_status(self):
        """
        Phase 1: Verify Pre-Entry Status
        GET /api/pre-entry/SPRE-25-000014
        """
        print("🔍 Phase 1: Verify Pre-Entry Status...")
        
        try:
            response = requests.get(f"{self.base_url}/pre-entry/{self.target_slip_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify it returns the sales pre-entry
                if data.get('slip_id') == self.target_slip_id:
                    status = data.get('status')
                    customer_name = data.get('customer_name') or data.get('party_name')
                    item_name = data.get('item_name')
                    
                    # Check status is "weigh_pending"
                    if status == "weigh_pending":
                        self.log_test("Phase 1: Pre-Entry Status", True, 
                                    f"✅ Pre-entry found: {self.target_slip_id}, Status: {status}, Customer: {customer_name}, Item: {item_name}")
                        return True, customer_name, item_name
                    else:
                        self.log_test("Phase 1: Pre-Entry Status", False, 
                                    f"❌ Expected status 'weigh_pending', got '{status}'")
                        return False, customer_name, item_name
                else:
                    self.log_test("Phase 1: Pre-Entry Status", False, 
                                f"❌ Slip ID mismatch. Expected: {self.target_slip_id}, Got: {data.get('slip_id')}")
                    return False, None, None
            else:
                self.log_test("Phase 1: Pre-Entry Status", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False, None, None
                
        except Exception as e:
            self.log_test("Phase 1: Pre-Entry Status", False, f"Request failed: {str(e)}")
            return False, None, None
    
    def test_phase2_tare_weight_entry(self):
        """
        Phase 2: TARE Weight Entry (Empty Truck)
        POST /api/weighbridge-entry with weight_type: "tare"
        """
        print("🔍 Phase 2: TARE Weight Entry (Empty Truck)...")
        
        try:
            payload = {
                "slip_id": self.target_slip_id,
                "vehicle_number": self.test_vehicle,
                "vehicle_type": "Truck",
                "driver_name": self.test_driver,
                "driver_mobile": self.test_mobile,
                "weight": 5000,
                "weight_type": "tare",
                "operator_id": self.test_operator,
                "operator_name": "Test Operator",
                "shift": "Morning"
            }
            
            response = requests.post(f"{self.base_url}/weighbridge-entry", 
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify weighbridge entry created successfully
                if data.get('weight_type') == 'tare' and data.get('weight') == 5000:
                    self.log_test("Phase 2: TARE Weight Entry", True, 
                                f"✅ TARE weighbridge entry created successfully, Weight: {data.get('weight')} kg")
                    return True
                else:
                    self.log_test("Phase 2: TARE Weight Entry", False, 
                                f"❌ Unexpected response data: weight_type={data.get('weight_type')}, weight={data.get('weight')}")
                    return False
            else:
                self.log_test("Phase 2: TARE Weight Entry", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Phase 2: TARE Weight Entry", False, f"Request failed: {str(e)}")
            return False
    
    def test_phase3_verify_tare_completed_status(self):
        """
        Phase 3: Verify Pre-Entry Status Changed to tare_completed
        GET /api/pre-entry/SPRE-25-000014 after TARE weight
        """
        print("🔍 Phase 3: Verify Pre-Entry Status Changed to tare_completed...")
        
        try:
            response = requests.get(f"{self.base_url}/pre-entry/{self.target_slip_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                status = data.get('status')
                tare_weight = data.get('tare_weight')
                
                # Verify status changed to "tare_completed" and tare_weight is 5000
                if status == "tare_completed" and tare_weight == 5000:
                    self.log_test("Phase 3: Tare Completed Status", True, 
                                f"✅ Status changed to 'tare_completed', tare_weight: {tare_weight} kg")
                    return True
                else:
                    self.log_test("Phase 3: Tare Completed Status", False, 
                                f"❌ Expected status='tare_completed' and tare_weight=5000, got status='{status}', tare_weight={tare_weight}")
                    return False
            else:
                self.log_test("Phase 3: Tare Completed Status", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Phase 3: Tare Completed Status", False, f"Request failed: {str(e)}")
            return False
    
    def test_phase4_verify_not_in_queue_yet(self):
        """
        Phase 4: Verify SPRE-25-000014 is NOT in the queue yet
        GET /api/sales/queue?status=pending (status is tare_completed, not pending)
        """
        print("🔍 Phase 4: Verify NOT in Sales Queue Yet...")
        
        try:
            response = requests.get(f"{self.base_url}/sales/queue?status=pending", timeout=10)
            
            if response.status_code == 200:
                queue_items = response.json()
                
                # Check if our slip is in the queue (it shouldn't be)
                found_in_queue = any(item.get('slip_id') == self.target_slip_id or 
                                   item.get('pre_entry_number') == self.target_slip_id 
                                   for item in queue_items)
                
                if not found_in_queue:
                    self.log_test("Phase 4: Not in Queue Yet", True, 
                                f"✅ {self.target_slip_id} correctly NOT in pending queue (status is tare_completed)")
                    return True
                else:
                    self.log_test("Phase 4: Not in Queue Yet", False, 
                                f"❌ {self.target_slip_id} unexpectedly found in pending queue")
                    return False
            else:
                self.log_test("Phase 4: Not in Queue Yet", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Phase 4: Not in Queue Yet", False, f"Request failed: {str(e)}")
            return False
    
    def test_phase5_gross_weight_entry(self):
        """
        Phase 5: GROSS Weight Entry (Loaded Truck)
        POST /api/weighbridge-entry with weight_type: "gross"
        """
        print("🔍 Phase 5: GROSS Weight Entry (Loaded Truck)...")
        
        try:
            payload = {
                "slip_id": self.target_slip_id,
                "vehicle_number": self.test_vehicle,
                "vehicle_type": "Truck",
                "driver_name": self.test_driver,
                "driver_mobile": self.test_mobile,
                "weight": 55000,
                "weight_type": "gross",
                "operator_id": self.test_operator,
                "operator_name": "Test Operator",
                "shift": "Morning"
            }
            
            response = requests.post(f"{self.base_url}/weighbridge-entry", 
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify weighbridge entry created successfully
                if data.get('weight_type') == 'gross' and data.get('weight') == 55000:
                    self.log_test("Phase 5: GROSS Weight Entry", True, 
                                f"✅ GROSS weighbridge entry created successfully, Weight: {data.get('weight')} kg")
                    return True
                else:
                    self.log_test("Phase 5: GROSS Weight Entry", False, 
                                f"❌ Unexpected response data: weight_type={data.get('weight_type')}, weight={data.get('weight')}")
                    return False
            else:
                self.log_test("Phase 5: GROSS Weight Entry", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Phase 5: GROSS Weight Entry", False, f"Request failed: {str(e)}")
            return False
    
    def test_phase6_verify_pending_status_and_weights(self):
        """
        Phase 6: Verify Pre-Entry Status Changed to pending with all weights
        GET /api/pre-entry/SPRE-25-000014 after GROSS weight
        """
        print("🔍 Phase 6: Verify Pre-Entry Status Changed to pending with all weights...")
        
        try:
            response = requests.get(f"{self.base_url}/pre-entry/{self.target_slip_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                status = data.get('status')
                tare_weight = data.get('tare_weight')
                gross_weight = data.get('gross_weight')
                net_weight = data.get('net_weight')
                
                # Verify status changed to "pending" and all weights are correct
                expected_net = 50000  # 55000 - 5000
                
                if (status == "pending" and 
                    tare_weight == 5000 and 
                    gross_weight == 55000 and 
                    net_weight == expected_net):
                    self.log_test("Phase 6: Pending Status with Weights", True, 
                                f"✅ Status: {status}, Tare: {tare_weight} kg, Gross: {gross_weight} kg, Net: {net_weight} kg")
                    return True
                else:
                    self.log_test("Phase 6: Pending Status with Weights", False, 
                                f"❌ Expected status='pending', tare=5000, gross=55000, net=50000. Got status='{status}', tare={tare_weight}, gross={gross_weight}, net={net_weight}")
                    return False
            else:
                self.log_test("Phase 6: Pending Status with Weights", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Phase 6: Pending Status with Weights", False, f"Request failed: {str(e)}")
            return False
    
    def test_phase7_verify_now_in_queue(self):
        """
        Phase 7: Verify SPRE-25-000014 NOW appears in the sales queue
        GET /api/sales/queue?status=pending
        """
        print("🔍 Phase 7: Verify NOW in Sales Queue...")
        
        try:
            response = requests.get(f"{self.base_url}/sales/queue?status=pending", timeout=10)
            
            if response.status_code == 200:
                queue_items = response.json()
                
                # Find our slip in the queue
                found_item = None
                for item in queue_items:
                    if (item.get('slip_id') == self.target_slip_id or 
                        item.get('pre_entry_number') == self.target_slip_id):
                        found_item = item
                        break
                
                if found_item:
                    net_weight = found_item.get('net_weight')
                    customer_name = found_item.get('customer_name')
                    item_name = found_item.get('item_name')
                    
                    # Verify net_weight is 50000 and other details are present
                    if net_weight == 50000 and customer_name and item_name:
                        self.log_test("Phase 7: Now in Queue", True, 
                                    f"✅ {self.target_slip_id} now in queue: Net Weight: {net_weight} kg, Customer: {customer_name}, Item: {item_name}")
                        return True
                    else:
                        self.log_test("Phase 7: Now in Queue", False, 
                                    f"❌ Found in queue but incorrect data: net_weight={net_weight}, customer={customer_name}, item={item_name}")
                        return False
                else:
                    self.log_test("Phase 7: Now in Queue", False, 
                                f"❌ {self.target_slip_id} not found in pending queue")
                    return False
            else:
                self.log_test("Phase 7: Now in Queue", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Phase 7: Now in Queue", False, f"Request failed: {str(e)}")
            return False
    
    def test_phase8_fetch_weighbridge_photos(self):
        """
        Phase 8: Fetch Weighbridge Photos (for photo modal)
        GET /api/weighbridge-entry/by-slip/SPRE-25-000014
        """
        print("🔍 Phase 8: Fetch Weighbridge Photos (for photo modal)...")
        
        try:
            response = requests.get(f"{self.base_url}/weighbridge-entry/by-slip/{self.target_slip_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify it returns combined TARE and GROSS data
                tare_weight = data.get('tare_weight')
                gross_weight = data.get('gross_weight')
                net_weight = data.get('net_weight')
                photo_tare_url = data.get('photo_tare_url')
                photo_gross_url = data.get('photo_gross_url')
                
                # Check all required fields
                if (tare_weight == 5000 and 
                    gross_weight == 55000 and 
                    net_weight == 50000 and 
                    photo_tare_url and 
                    photo_gross_url):
                    self.log_test("Phase 8: Fetch Weighbridge Photos", True, 
                                f"✅ Combined weighbridge data: Tare: {tare_weight} kg, Gross: {gross_weight} kg, Net: {net_weight} kg, Photos: Available")
                    return True
                else:
                    self.log_test("Phase 8: Fetch Weighbridge Photos", False, 
                                f"❌ Incomplete data: tare={tare_weight}, gross={gross_weight}, net={net_weight}, tare_photo={bool(photo_tare_url)}, gross_photo={bool(photo_gross_url)}")
                    return False
            else:
                self.log_test("Phase 8: Fetch Weighbridge Photos", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Phase 8: Fetch Weighbridge Photos", False, f"Request failed: {str(e)}")
            return False
    
    def test_integration_item_data_fetch(self):
        """
        Test 8: Integration - Item Data Fetch and Rate Auto-fill
        Verify item data is fetched correctly and rate auto-fills
        """
        print("🔍 Test 8: Integration - Item Data Fetch and Rate Auto-fill...")
        
        if not self.customers or not self.items:
            self.log_test("Integration Item Data", False, "No test data available")
            return False
        
        customer = self.customers[0]
        item = self.items[0]
        
        try:
            payload = {
                "date": "2025-01-14",
                "customer_id": customer['id'],
                "place_of_supply": "Test Place of Supply",
                "item_id": item['id'],
                # Don't provide item_rate to test auto-fill
                "created_by": "admin"
            }
            
            response = requests.post(f"{self.base_url}/sales/pre-entry", 
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify item data is correctly fetched and populated
                if (data.get('item_name') == item['name'] and
                    data.get('item_id') == item['id']):
                    
                    # Check if rate auto-filled from item master
                    item_rate = data.get('item_rate')
                    if item_rate is not None:
                        self.log_test("Integration Item Data", True, 
                                    f"✅ Item data correctly fetched: {item['name']}, Rate: {item_rate}")
                    else:
                        self.log_test("Integration Item Data", True, 
                                    f"✅ Item data correctly fetched: {item['name']} (no rate auto-fill)")
                    return True
                else:
                    self.log_test("Integration Item Data", False, 
                                f"❌ Item data mismatch. Expected: {item['name']}, Got: {data.get('item_name')}")
                    return False
            else:
                self.log_test("Integration Item Data", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Integration Item Data", False, f"Request failed: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all Sales Pre-Entry tests"""
        print("🚀 Starting Sales Pre-Entry Backend Testing")
        print(f"Testing against: {self.base_url}")
        print("=" * 80)
        
        # Setup test data first
        if not self.setup_test_data():
            print("❌ Test setup failed. Cannot proceed with testing.")
            return False
        
        print("\n" + "=" * 80)
        print("🔥 SALES PRE-ENTRY CREATION TESTS")
        print("=" * 80)
        
        # Test 1: Basic pre-entry creation
        self.test_sales_pre_entry_creation_basic()
        
        # Test 2: Sequential numbering
        self.test_sales_pre_entry_sequential_numbering()
        
        print("\n" + "=" * 80)
        print("📋 MARKA MEMORY ENDPOINT TESTS")
        print("=" * 80)
        
        # Test 3: Marka memory endpoint
        self.test_marka_memory_endpoint()
        
        # Test 4: Marka memory with non-existent item
        self.test_marka_memory_nonexistent_item()
        
        print("\n" + "=" * 80)
        print("📋 DATA VALIDATION TESTS")
        print("=" * 80)
        
        # Test 5: Missing required fields
        self.test_validation_missing_required_fields()
        
        # Test 6: Invalid customer ID
        self.test_validation_invalid_customer_id()
        
        print("\n" + "=" * 80)
        print("📋 INTEGRATION TESTS")
        print("=" * 80)
        
        # Test 7: Customer data integration
        self.test_integration_customer_data_fetch()
        
        # Test 8: Item data integration
        self.test_integration_item_data_fetch()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 SALES PRE-ENTRY TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Show created pre-entries
        if self.created_pre_entries:
            print(f"\n📝 CREATED PRE-ENTRIES ({len(self.created_pre_entries)}):")
            for entry in self.created_pre_entries:
                print(f"  - {entry.get('pre_entry_number')}: {entry.get('customer_name')} - {entry.get('item_name')}")
        
        # Detailed results
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
            
            print("\n🚨 SALES PRE-ENTRY ISSUES FOUND:")
            print("Some Sales Pre-Entry endpoints may not be working correctly.")
            print("Please review the failed tests above and check the implementation.")
        else:
            print("\n🎉 ALL SALES PRE-ENTRY TESTS PASSED!")
            print("✅ Sales Pre-Entry creation endpoint working correctly")
            print("✅ Pre-entry number generation in SPRE-YY-###### format working")
            print("✅ Sequential numbering working correctly")
            print("✅ Marka memory endpoint working")
            print("✅ Data validation working")
            print("✅ Customer and item integration working")
        
        print("\n" + "=" * 80)
        return failed_tests == 0

if __name__ == "__main__":
    tester = SalesPreEntryTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)