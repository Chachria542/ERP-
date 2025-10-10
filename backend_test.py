#!/usr/bin/env python3
"""
Backend API Testing for Farmer Payment Module
Tests all endpoints according to test_result.md requirements
"""
import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://farmers-ledger.preview.emergentagent.com/api"

class FarmerPaymentTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.items = {}
        self.weighbridge_data = {}
        
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
    
    def test_items_endpoint(self):
        """Test GET /api/items - Check if mock data exists"""
        print("🔍 Testing Items Endpoint...")
        try:
            response = requests.get(f"{self.base_url}/items", timeout=10)
            
            if response.status_code == 200:
                items = response.json()
                if len(items) >= 4:
                    # Store items for later use
                    for item in items:
                        self.items[item['name']] = item
                    
                    wheat_found = any('Wheat' in item['name'] for item in items)
                    soybean_found = any('Soybean' in item['name'] for item in items)
                    chana_found = any('Chana' in item['name'] for item in items)
                    corn_found = any('Corn' in item['name'] for item in items)
                    
                    if wheat_found and soybean_found and chana_found and corn_found:
                        self.log_test("Items Endpoint", True, f"Found {len(items)} items including Wheat, Soybean, Chana, Corn")
                    else:
                        self.log_test("Items Endpoint", False, f"Missing required items. Found: {[item['name'] for item in items]}")
                else:
                    self.log_test("Items Endpoint", False, f"Expected at least 4 items, found {len(items)}")
            else:
                self.log_test("Items Endpoint", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Items Endpoint", False, f"Request failed: {str(e)}")
    
    def test_weighbridge_slip_fetch(self):
        """Test GET /api/weighbridge/slip/{gate_entry_no}"""
        print("🔍 Testing Weighbridge Slip Fetch...")
        
        # Test valid gate entries
        gate_entries = ["GT001", "GT002", "GT003"]
        
        for gate_entry in gate_entries:
            try:
                response = requests.get(f"{self.base_url}/weighbridge/slip/{gate_entry}", timeout=10)
                
                if response.status_code == 200:
                    slip_data = response.json()
                    
                    # Store for later use
                    self.weighbridge_data[gate_entry] = slip_data
                    
                    # Check required fields
                    required_fields = [
                        'farmer_name', 'mobile', 'city', 'token_no', 'vehicle_number', 
                        'vehicle_type', 'item_id', 'item_name', 'bags', 'rem_kg', 
                        'act_qtl', 'photo_gross_url', 'photo_tare_url'
                    ]
                    
                    missing_fields = [field for field in required_fields if field not in slip_data or slip_data[field] is None]
                    
                    if not missing_fields:
                        self.log_test(f"Weighbridge Slip Fetch - {gate_entry}", True, 
                                    f"All required fields present. Farmer: {slip_data.get('farmer_name')}, Item: {slip_data.get('item_name')}, Qtl: {slip_data.get('act_qtl')}")
                    else:
                        self.log_test(f"Weighbridge Slip Fetch - {gate_entry}", False, 
                                    f"Missing fields: {missing_fields}", slip_data)
                        
                elif response.status_code == 400 and "already settled" in response.text:
                    self.log_test(f"Weighbridge Slip Fetch - {gate_entry}", True, 
                                "Slip already settled (expected behavior)")
                else:
                    self.log_test(f"Weighbridge Slip Fetch - {gate_entry}", False, 
                                f"HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_test(f"Weighbridge Slip Fetch - {gate_entry}", False, f"Request failed: {str(e)}")
        
        # Test non-existent gate entry
        try:
            response = requests.get(f"{self.base_url}/weighbridge/slip/GT999", timeout=10)
            if response.status_code == 404:
                self.log_test("Weighbridge Slip Fetch - Non-existent", True, "Correctly returned 404 for non-existent gate entry")
            else:
                self.log_test("Weighbridge Slip Fetch - Non-existent", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_test("Weighbridge Slip Fetch - Non-existent", False, f"Request failed: {str(e)}")
    
    def test_book_number_generation(self):
        """Test GET /api/book-number-next?location=Sanawad"""
        print("🔍 Testing Book Number Generation...")
        
        try:
            response = requests.get(f"{self.base_url}/book-number-next?location=Sanawad", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                book_no = data.get('book_no', '')
                
                # Check format: SAN-YY-######
                if book_no.startswith('SAN-') and len(book_no.split('-')) == 3:
                    parts = book_no.split('-')
                    if len(parts[1]) == 2 and len(parts[2]) == 6 and parts[2].isdigit():
                        self.log_test("Book Number Generation", True, f"Generated: {book_no}")
                    else:
                        self.log_test("Book Number Generation", False, f"Invalid format: {book_no}")
                else:
                    self.log_test("Book Number Generation", False, f"Invalid format: {book_no}")
            else:
                self.log_test("Book Number Generation", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Book Number Generation", False, f"Request failed: {str(e)}")
    
    def test_farmer_payment_creation(self):
        """Test POST /api/farmer-payment"""
        print("🔍 Testing Farmer Payment Creation...")
        
        # Check if we have weighbridge data
        if not self.weighbridge_data:
            self.log_test("Farmer Payment Creation", False, "No weighbridge data available for testing")
            return
        
        # Use GT001 data if available
        gate_entry = "GT001"
        if gate_entry not in self.weighbridge_data:
            gate_entry = list(self.weighbridge_data.keys())[0]
        
        slip_data = self.weighbridge_data[gate_entry]
        
        # Find wheat item
        wheat_item = None
        for item in self.items.values():
            if 'Wheat' in item['name']:
                wheat_item = item
                break
        
        if not wheat_item:
            self.log_test("Farmer Payment Creation", False, "Wheat item not found for testing")
            return
        
        # Create payment payload
        payload = {
            "location": "Sanawad",
            "contract_type": "Anubandh",
            "mandi_godown": "Mandi",
            "date": "2025-01-10",
            "gate_entry_no": gate_entry,
            "farmer_name": slip_data.get('farmer_name', 'Test Farmer'),
            "mobile": slip_data.get('mobile', '9876543210'),
            "city": slip_data.get('city', 'Sanawad'),
            "token_no": slip_data.get('token_no', 'TK123'),
            "lines": [{
                "item_id": wheat_item['id'],
                "item_name": wheat_item['name'],
                "pack_kg": 100,
                "bags": slip_data.get('bags', 52),
                "rem_kg": slip_data.get('rem_kg', 34),
                "act_kg": slip_data.get('bags', 52) * 100 + slip_data.get('rem_kg', 34),
                "act_qtl": slip_data.get('act_qtl', 52.34),
                "rate_per_qtl": 2500,
                "item_amount": slip_data.get('act_qtl', 52.34) * 2500,
                "vehicle_type": slip_data.get('vehicle_type', 'Truck'),
                "h_plus_t": 248.615,
                "line_total": (slip_data.get('act_qtl', 52.34) * 2500) - 248.615,
                "sort_order": 0
            }],
            "pay_type": "Cash",
            "cash_amt": (slip_data.get('act_qtl', 52.34) * 2500) - 248.615,
            "bank_amt": 0,
            "additional_hamli": 0,
            "bank_charges": 0,
            "created_by": "test_user_id"
        }
        
        try:
            response = requests.post(f"{self.base_url}/farmer-payment", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=15)
            
            if response.status_code == 200:
                payment_data = response.json()
                
                # Check required response fields
                required_fields = ['book_no', 'total_amount', 'purchase_voucher_id', 'payment_voucher_id']
                missing_fields = [field for field in required_fields if field not in payment_data]
                
                if not missing_fields:
                    self.log_test("Farmer Payment Creation", True, 
                                f"Payment created successfully. Book No: {payment_data.get('book_no')}, Amount: ₹{payment_data.get('total_amount')}")
                    
                    # Store payment ID for later tests
                    self.created_payment_id = payment_data.get('id')
                else:
                    self.log_test("Farmer Payment Creation", False, 
                                f"Missing response fields: {missing_fields}", payment_data)
            else:
                self.log_test("Farmer Payment Creation", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Farmer Payment Creation", False, f"Request failed: {str(e)}")
    
    def test_farmer_payments_list(self):
        """Test GET /api/farmer-payments"""
        print("🔍 Testing Farmer Payments List...")
        
        try:
            response = requests.get(f"{self.base_url}/farmer-payments", timeout=10)
            
            if response.status_code == 200:
                payments = response.json()
                
                if isinstance(payments, list):
                    if len(payments) > 0:
                        # Check if our created payment is in the list
                        payment_found = False
                        if hasattr(self, 'created_payment_id'):
                            payment_found = any(p.get('id') == self.created_payment_id for p in payments)
                        
                        self.log_test("Farmer Payments List", True, 
                                    f"Retrieved {len(payments)} payments. Created payment found: {payment_found}")
                    else:
                        self.log_test("Farmer Payments List", True, "No payments found (empty list is valid)")
                else:
                    self.log_test("Farmer Payments List", False, f"Expected list, got {type(payments)}")
            else:
                self.log_test("Farmer Payments List", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Farmer Payments List", False, f"Request failed: {str(e)}")
    
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