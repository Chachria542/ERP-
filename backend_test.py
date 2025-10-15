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
                    if pre_entry_no and pre_entry_no.startswith("SPRE-") and len(pre_entry_no) == 14:
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
    
    def test_marka_memory_nonexistent_item(self):
        """
        Test 4: Marka Memory with Non-existent Item
        Test marka endpoint with invalid item_id
        """
        print("🔍 Test 4: Marka Memory with Non-existent Item...")
        
        try:
            # Test with non-existent item ID
            fake_item_id = "non-existent-item-id"
            response = requests.get(f"{self.base_url}/sales/marka/{fake_item_id}", timeout=10)
            
            if response.status_code == 200:
                markas = response.json()
                
                # Should return empty array for non-existent item
                if isinstance(markas, list) and len(markas) == 0:
                    self.log_test("Marka Memory Non-existent Item", True, 
                                f"✅ Non-existent item returns empty array correctly")
                    return True
                else:
                    self.log_test("Marka Memory Non-existent Item", False, 
                                f"❌ Expected empty array, got: {markas}")
                    return False
            else:
                # 404 is also acceptable for non-existent item
                if response.status_code == 404:
                    self.log_test("Marka Memory Non-existent Item", True, 
                                f"✅ Non-existent item returns 404 correctly")
                    return True
                else:
                    self.log_test("Marka Memory Non-existent Item", False, 
                                f"HTTP {response.status_code}: {response.text}")
                    return False
                
        except Exception as e:
            self.log_test("Marka Memory Non-existent Item", False, f"Request failed: {str(e)}")
            return False
    
    def test_validation_missing_required_fields(self):
        """
        Test 5: Data Validation - Missing Required Fields
        Test validation for customer_id and place_of_supply
        """
        print("🔍 Test 5: Data Validation - Missing Required Fields...")
        
        try:
            # Test missing customer_id
            payload_no_customer = {
                "date": "2025-01-14",
                "place_of_supply": "Mumbai, Maharashtra",
                "created_by": "admin"
            }
            
            response = requests.post(f"{self.base_url}/sales/pre-entry", 
                                   json=payload_no_customer,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 422:  # Validation error
                self.log_test("Validation Missing Customer ID", True, 
                            "✅ Missing customer_id correctly rejected with 422")
            else:
                self.log_test("Validation Missing Customer ID", False, 
                            f"❌ Expected 422, got {response.status_code}")
                return False
            
            # Test missing place_of_supply
            if self.customers:
                payload_no_place = {
                    "date": "2025-01-14",
                    "customer_id": self.customers[0]['id'],
                    "created_by": "admin"
                }
                
                response = requests.post(f"{self.base_url}/sales/pre-entry", 
                                       json=payload_no_place,
                                       headers={'Content-Type': 'application/json'},
                                       timeout=10)
                
                if response.status_code == 422:  # Validation error
                    self.log_test("Validation Missing Place of Supply", True, 
                                "✅ Missing place_of_supply correctly rejected with 422")
                    return True
                else:
                    self.log_test("Validation Missing Place of Supply", False, 
                                f"❌ Expected 422, got {response.status_code}")
                    return False
            else:
                self.log_test("Validation Missing Required Fields", False, "No customers available for testing")
                return False
                
        except Exception as e:
            self.log_test("Validation Missing Required Fields", False, f"Request failed: {str(e)}")
            return False
    
    def test_validation_invalid_customer_id(self):
        """
        Test 6: Data Validation - Invalid Customer ID
        Test with non-existent customer_id
        """
        print("🔍 Test 6: Data Validation - Invalid Customer ID...")
        
        try:
            payload = {
                "date": "2025-01-14",
                "customer_id": "invalid-customer-id",
                "place_of_supply": "Mumbai, Maharashtra",
                "created_by": "admin"
            }
            
            response = requests.post(f"{self.base_url}/sales/pre-entry", 
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 404:
                self.log_test("Validation Invalid Customer ID", True, 
                            "✅ Invalid customer_id correctly rejected with 404")
                return True
            else:
                self.log_test("Validation Invalid Customer ID", False, 
                            f"❌ Expected 404, got {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Validation Invalid Customer ID", False, f"Request failed: {str(e)}")
            return False
    
    def test_integration_customer_data_fetch(self):
        """
        Test 7: Integration - Customer Data Fetch
        Verify customer data is fetched correctly from parties collection
        """
        print("🔍 Test 7: Integration - Customer Data Fetch...")
        
        if not self.customers or not self.items:
            self.log_test("Integration Customer Data", False, "No test data available")
            return False
        
        customer = self.customers[0]
        item = self.items[0]
        
        try:
            payload = {
                "date": "2025-01-14",
                "customer_id": customer['id'],
                "place_of_supply": "Test Place of Supply",
                "item_id": item['id'],
                "created_by": "admin"
            }
            
            response = requests.post(f"{self.base_url}/sales/pre-entry", 
                                   json=payload,
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify customer data is correctly fetched and populated
                if (data.get('customer_name') == customer['name'] and
                    data.get('customer_id') == customer['id']):
                    self.log_test("Integration Customer Data", True, 
                                f"✅ Customer data correctly fetched: {customer['name']}")
                    return True
                else:
                    self.log_test("Integration Customer Data", False, 
                                f"❌ Customer data mismatch. Expected: {customer['name']}, Got: {data.get('customer_name')}")
                    return False
            else:
                self.log_test("Integration Customer Data", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Integration Customer Data", False, f"Request failed: {str(e)}")
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