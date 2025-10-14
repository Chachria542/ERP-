#!/usr/bin/env python3
"""
Universal Weighbridge System - Backend API Testing
Tests NEW universal weighbridge endpoints according to review request
"""
import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://erpsupply-chain.preview.emergentagent.com/api"

class UniversalWeighbridgeTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        self.items = {}
        self.created_slips = []
        self.wheat_item_id = None
        
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
        """Get available items for testing"""
        print("🔧 Setting up test data...")
        try:
            response = requests.get(f"{self.base_url}/items", timeout=10)
            
            if response.status_code == 200:
                items = response.json()
                for item in items:
                    self.items[item['name']] = item
                    if 'Wheat' in item['name'] or 'wheat' in item['name'].lower():
                        self.wheat_item_id = item['id']
                
                if self.wheat_item_id:
                    print(f"✅ Found {len(items)} items. Using Wheat item: {self.wheat_item_id}")
                    return True
                else:
                    print("❌ No Wheat item found for testing")
                    return False
            else:
                print(f"❌ Failed to fetch items: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Setup failed: {str(e)}")
            return False
    
    def test_pre_entry_farmer_purchase(self):
        """Test Case 1: Farmer Purchase Pre-Entry"""
        print("🔍 Testing Pre-Entry Creation - Farmer Purchase...")
        
        if not self.wheat_item_id:
            self.log_test("Pre-Entry Farmer Purchase", False, "No wheat item available for testing")
            return
        
        payload = {
            "transaction_type": "farmer_purchase",
            "from_location": "Sanawad Mandi",
            "party_type": "farmer",
            "party_name": "Test Farmer",
            "party_mobile": "9999000001",
            "item_id": self.wheat_item_id,
            "quality": "Grade A",
            "expected_bags": 50,
            "rate_per_qtl": 2500.0,
            "remarks": "First test pre-entry",
            "created_by": "test_user"
        }
        
        try:
            response = requests.post(f"{self.base_url}/pre-entry", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for farmer conflict response
                if data.get('farmer_conflict'):
                    self.log_test("Pre-Entry Farmer Purchase", True, 
                                f"Farmer conflict detected: existing '{data.get('existing_name')}' vs new '{data.get('new_name')}'")
                    return
                
                # Check required fields
                required_fields = ['slip_id', 'qr_code', 'id']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    slip_id = data.get('slip_id')
                    qr_code = data.get('qr_code')
                    
                    # Validate slip_id format: WB-25-000001
                    if slip_id and slip_id.startswith('WB-') and len(slip_id.split('-')) == 3:
                        # Validate QR code format
                        expected_qr = f"SLIP:{slip_id}|TYPE:farmer_purchase"
                        if qr_code == expected_qr:
                            self.created_slips.append(slip_id)
                            self.log_test("Pre-Entry Farmer Purchase", True, 
                                        f"Created slip: {slip_id}, QR: {qr_code}")
                        else:
                            self.log_test("Pre-Entry Farmer Purchase", False, 
                                        f"Invalid QR code. Expected: {expected_qr}, Got: {qr_code}")
                    else:
                        self.log_test("Pre-Entry Farmer Purchase", False, 
                                    f"Invalid slip_id format: {slip_id}")
                else:
                    self.log_test("Pre-Entry Farmer Purchase", False, 
                                f"Missing fields: {missing_fields}", data)
            else:
                self.log_test("Pre-Entry Farmer Purchase", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Pre-Entry Farmer Purchase", False, f"Request failed: {str(e)}")
    
    def test_pre_entry_internal_transfer(self):
        """Test Case 2: Internal Transfer Pre-Entry"""
        print("🔍 Testing Pre-Entry Creation - Internal Transfer...")
        
        if not self.wheat_item_id:
            self.log_test("Pre-Entry Internal Transfer", False, "No wheat item available for testing")
            return
        
        payload = {
            "transaction_type": "internal_transfer",
            "from_location": "Warehouse A",
            "to_location": "Warehouse B",
            "party_type": "own_stock",
            "party_name": "Own Stock",
            "item_id": self.wheat_item_id,
            "challan_number": "CH-001",
            "expected_bags": 100,
            "created_by": "test_user"
        }
        
        try:
            response = requests.post(f"{self.base_url}/pre-entry", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                required_fields = ['slip_id', 'qr_code', 'id']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    slip_id = data.get('slip_id')
                    qr_code = data.get('qr_code')
                    
                    # Validate slip_id format: WB-25-000002
                    if slip_id and slip_id.startswith('WB-') and len(slip_id.split('-')) == 3:
                        # Validate QR code format
                        expected_qr = f"SLIP:{slip_id}|TYPE:internal_transfer"
                        if qr_code == expected_qr:
                            self.created_slips.append(slip_id)
                            self.log_test("Pre-Entry Internal Transfer", True, 
                                        f"Created slip: {slip_id}, QR: {qr_code}")
                        else:
                            self.log_test("Pre-Entry Internal Transfer", False, 
                                        f"Invalid QR code. Expected: {expected_qr}, Got: {qr_code}")
                    else:
                        self.log_test("Pre-Entry Internal Transfer", False, 
                                    f"Invalid slip_id format: {slip_id}")
                else:
                    self.log_test("Pre-Entry Internal Transfer", False, 
                                f"Missing fields: {missing_fields}", data)
            else:
                self.log_test("Pre-Entry Internal Transfer", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Pre-Entry Internal Transfer", False, f"Request failed: {str(e)}")
    
    def test_weighbridge_entry_creation(self):
        """Test Weighbridge Entry Creation"""
        print("🔍 Testing Weighbridge Entry Creation...")
        
        if not self.created_slips:
            self.log_test("Weighbridge Entry Creation", False, "No pre-entry slips available for testing")
            return
        
        # Use first created slip
        slip_id = self.created_slips[0]
        
        payload = {
            "slip_id": slip_id,
            "vehicle_number": "MP09TEST001",
            "vehicle_type": "Truck",
            "driver_name": "Driver Name",
            "driver_mobile": "9888777666",
            "gross_weight": 15000.0,
            "tare_weight": 10000.0,
            "operator_id": "op_001",
            "operator_name": "Operator Test",
            "shift": "Morning"
        }
        
        try:
            response = requests.post(f"{self.base_url}/weighbridge-entry", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check calculated values
                expected_net_weight = 5000.0  # 15000 - 10000
                expected_bags = 50  # 5000 // 100
                expected_rem_kg = 0  # 5000 % 100
                expected_act_qtl = 50.00  # 5000 / 100
                
                net_weight = data.get('net_weight')
                bags = data.get('bags')
                rem_kg = data.get('rem_kg')
                act_qtl = data.get('act_qtl')
                
                if (net_weight == expected_net_weight and 
                    bags == expected_bags and 
                    rem_kg == expected_rem_kg and 
                    act_qtl == expected_act_qtl):
                    
                    # Check photo URLs exist
                    if data.get('photo_gross_url') and data.get('photo_tare_url'):
                        self.log_test("Weighbridge Entry Creation", True, 
                                    f"Entry created for {slip_id}. Net: {net_weight}kg, Bags: {bags}, Rem: {rem_kg}kg, Qtl: {act_qtl}")
                    else:
                        self.log_test("Weighbridge Entry Creation", False, 
                                    "Missing photo URLs in response")
                else:
                    self.log_test("Weighbridge Entry Creation", False, 
                                f"Calculation error. Expected: net={expected_net_weight}, bags={expected_bags}, rem={expected_rem_kg}, qtl={expected_act_qtl}. Got: net={net_weight}, bags={bags}, rem={rem_kg}, qtl={act_qtl}")
            else:
                self.log_test("Weighbridge Entry Creation", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Weighbridge Entry Creation", False, f"Request failed: {str(e)}")
    
    def test_weighbridge_entry_fetch(self):
        """Test Fetch Weighbridge Entry for Auto-fill"""
        print("🔍 Testing Weighbridge Entry Fetch...")
        
        if not self.created_slips:
            self.log_test("Weighbridge Entry Fetch", False, "No slips available for testing")
            return
        
        # Use first created slip
        slip_id = self.created_slips[0]
        
        try:
            response = requests.get(f"{self.base_url}/weighbridge-entry/{slip_id}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check combined data fields
                weighbridge_fields = ['vehicle_number', 'gross_weight', 'tare_weight', 'net_weight', 'bags', 'rem_kg', 'act_qtl', 'photo_gross_url', 'photo_tare_url']
                pre_entry_fields = ['party_name', 'party_mobile', 'item_id', 'item_name', 'rate_per_qtl']
                
                missing_wb_fields = [field for field in weighbridge_fields if field not in data or data[field] is None]
                missing_pe_fields = [field for field in pre_entry_fields if field not in data or data[field] is None]
                
                if not missing_wb_fields and not missing_pe_fields:
                    self.log_test("Weighbridge Entry Fetch", True, 
                                f"Combined data retrieved for {slip_id}. Party: {data.get('party_name')}, Item: {data.get('item_name')}, Vehicle: {data.get('vehicle_number')}")
                else:
                    missing_all = missing_wb_fields + missing_pe_fields
                    self.log_test("Weighbridge Entry Fetch", False, 
                                f"Missing fields: {missing_all}")
            elif response.status_code == 404:
                self.log_test("Weighbridge Entry Fetch", False, 
                            f"Weighbridge entry not found for {slip_id} (may not be weighed yet)")
            else:
                self.log_test("Weighbridge Entry Fetch", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Weighbridge Entry Fetch", False, f"Request failed: {str(e)}")
    
    def test_farmer_auto_creation_conflict(self):
        """Test Farmer Auto-Creation & Conflict"""
        print("🔍 Testing Farmer Auto-Creation & Conflict...")
        
        if not self.wheat_item_id:
            self.log_test("Farmer Auto-Creation", False, "No wheat item available for testing")
            return
        
        # Test Case 1: Create pre-entry with NEW mobile
        new_mobile_payload = {
            "transaction_type": "farmer_purchase",
            "from_location": "Sanawad Mandi",
            "party_type": "farmer",
            "party_name": "New Farmer",
            "party_mobile": "9999000099",  # New mobile
            "item_id": self.wheat_item_id,
            "quality": "Grade A",
            "expected_bags": 25,
            "rate_per_qtl": 2500.0,
            "created_by": "test_user"
        }
        
        try:
            response = requests.post(f"{self.base_url}/pre-entry", 
                                   json=new_mobile_payload, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('slip_id'):
                    self.log_test("Farmer Auto-Creation - New Mobile", True, 
                                f"New farmer auto-created with mobile 9999000099")
                else:
                    self.log_test("Farmer Auto-Creation - New Mobile", False, 
                                "Failed to create pre-entry with new farmer")
            else:
                self.log_test("Farmer Auto-Creation - New Mobile", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Farmer Auto-Creation - New Mobile", False, f"Request failed: {str(e)}")
        
        # Test Case 2: Create pre-entry with EXISTING mobile but DIFFERENT name
        conflict_payload = {
            "transaction_type": "farmer_purchase",
            "from_location": "Sanawad Mandi",
            "party_type": "farmer",
            "party_name": "Different Name",  # Different from "Test Farmer"
            "party_mobile": "9999000001",  # Same mobile as first test
            "item_id": self.wheat_item_id,
            "quality": "Grade A",
            "expected_bags": 25,
            "rate_per_qtl": 2500.0,
            "created_by": "test_user"
        }
        
        try:
            response = requests.post(f"{self.base_url}/pre-entry", 
                                   json=conflict_payload, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('farmer_conflict'):
                    self.log_test("Farmer Conflict Detection", True, 
                                f"Conflict detected: existing '{data.get('existing_name')}' vs new '{data.get('new_name')}'")
                else:
                    self.log_test("Farmer Conflict Detection", False, 
                                "Expected farmer conflict but none detected")
            else:
                self.log_test("Farmer Conflict Detection", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Farmer Conflict Detection", False, f"Request failed: {str(e)}")
    
    def test_list_endpoints(self):
        """Test List Endpoints"""
        print("🔍 Testing List Endpoints...")
        
        # Test GET /api/pre-entries
        try:
            response = requests.get(f"{self.base_url}/pre-entries", timeout=10)
            
            if response.status_code == 200:
                entries = response.json()
                if isinstance(entries, list):
                    self.log_test("List Pre-Entries", True, f"Retrieved {len(entries)} pre-entries")
                else:
                    self.log_test("List Pre-Entries", False, f"Expected list, got {type(entries)}")
            else:
                self.log_test("List Pre-Entries", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("List Pre-Entries", False, f"Request failed: {str(e)}")
        
        # Test GET /api/pre-entries?status=pending
        try:
            response = requests.get(f"{self.base_url}/pre-entries?status=pending", timeout=10)
            
            if response.status_code == 200:
                entries = response.json()
                if isinstance(entries, list):
                    self.log_test("List Pre-Entries (Pending)", True, f"Retrieved {len(entries)} pending pre-entries")
                else:
                    self.log_test("List Pre-Entries (Pending)", False, f"Expected list, got {type(entries)}")
            else:
                self.log_test("List Pre-Entries (Pending)", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("List Pre-Entries (Pending)", False, f"Request failed: {str(e)}")
        
        # Test GET /api/weighbridge-entries
        try:
            response = requests.get(f"{self.base_url}/weighbridge-entries", timeout=10)
            
            if response.status_code == 200:
                entries = response.json()
                if isinstance(entries, list):
                    self.log_test("List Weighbridge Entries", True, f"Retrieved {len(entries)} weighbridge entries")
                else:
                    self.log_test("List Weighbridge Entries", False, f"Expected list, got {type(entries)}")
            else:
                self.log_test("List Weighbridge Entries", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("List Weighbridge Entries", False, f"Request failed: {str(e)}")
        
        # Test GET /api/farmers
        try:
            response = requests.get(f"{self.base_url}/farmers", timeout=10)
            
            if response.status_code == 200:
                farmers = response.json()
                if isinstance(farmers, list):
                    self.log_test("List Farmers", True, f"Retrieved {len(farmers)} farmers")
                else:
                    self.log_test("List Farmers", False, f"Expected list, got {type(farmers)}")
            else:
                self.log_test("List Farmers", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("List Farmers", False, f"Request failed: {str(e)}")
    
    def test_slip_id_sequential_generation(self):
        """Test Slip ID Sequential Generation"""
        print("🔍 Testing Slip ID Sequential Generation...")
        
        if not self.wheat_item_id:
            self.log_test("Sequential Slip ID Generation", False, "No wheat item available for testing")
            return
        
        created_slip_ids = []
        
        # Create 3 pre-entries and check sequential IDs
        for i in range(3):
            payload = {
                "transaction_type": "farmer_purchase",
                "from_location": "Sanawad Mandi",
                "party_type": "farmer",
                "party_name": f"Sequential Test Farmer {i+1}",
                "party_mobile": f"999900010{i}",
                "item_id": self.wheat_item_id,
                "quality": "Grade A",
                "expected_bags": 10,
                "rate_per_qtl": 2500.0,
                "created_by": "test_user"
            }
            
            try:
                response = requests.post(f"{self.base_url}/pre-entry", 
                                       json=payload, 
                                       headers={'Content-Type': 'application/json'},
                                       timeout=15)
                
                if response.status_code == 200:
                    data = response.json()
                    slip_id = data.get('slip_id')
                    if slip_id:
                        created_slip_ids.append(slip_id)
                        
            except Exception as e:
                self.log_test("Sequential Slip ID Generation", False, f"Request {i+1} failed: {str(e)}")
                return
        
        # Verify sequential generation
        if len(created_slip_ids) == 3:
            # Extract numbers from slip IDs
            numbers = []
            for slip_id in created_slip_ids:
                try:
                    number = int(slip_id.split('-')[-1])
                    numbers.append(number)
                except:
                    self.log_test("Sequential Slip ID Generation", False, f"Invalid slip ID format: {slip_id}")
                    return
            
            # Check if sequential
            if numbers[1] == numbers[0] + 1 and numbers[2] == numbers[1] + 1:
                self.log_test("Sequential Slip ID Generation", True, 
                            f"Sequential IDs generated: {created_slip_ids}")
            else:
                self.log_test("Sequential Slip ID Generation", False, 
                            f"Non-sequential IDs: {created_slip_ids} (numbers: {numbers})")
        else:
            self.log_test("Sequential Slip ID Generation", False, 
                        f"Expected 3 slip IDs, got {len(created_slip_ids)}")
    
    def test_edge_cases(self):
        """Test Edge Cases"""
        print("🔍 Testing Edge Cases...")
        
        # Test 1: Create weighbridge entry for non-existent slip_id
        payload = {
            "slip_id": "WB-25-999999",  # Non-existent
            "vehicle_number": "MP09TEST999",
            "vehicle_type": "Truck",
            "gross_weight": 15000.0,
            "tare_weight": 10000.0,
            "operator_id": "op_001",
            "operator_name": "Test Operator"
        }
        
        try:
            response = requests.post(f"{self.base_url}/weighbridge-entry", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            
            if response.status_code == 404 or (response.status_code == 400 and "not found" in response.text.lower()):
                self.log_test("Edge Case - Non-existent Slip ID", True, 
                            "Correctly rejected non-existent slip ID")
            else:
                self.log_test("Edge Case - Non-existent Slip ID", False, 
                            f"Expected 404 or 400 with 'not found', got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Edge Case - Non-existent Slip ID", False, f"Request failed: {str(e)}")
        
        # Test 2: Create weighbridge entry for already weighed slip
        if self.created_slips:
            duplicate_payload = {
                "slip_id": self.created_slips[0],  # Already weighed
                "vehicle_number": "MP09TEST888",
                "vehicle_type": "Truck",
                "gross_weight": 12000.0,
                "tare_weight": 8000.0,
                "operator_id": "op_002",
                "operator_name": "Test Operator 2"
            }
            
            try:
                response = requests.post(f"{self.base_url}/weighbridge-entry", 
                                       json=duplicate_payload, 
                                       headers={'Content-Type': 'application/json'},
                                       timeout=10)
                
                if response.status_code == 400 and "already weighed" in response.text:
                    self.log_test("Edge Case - Already Weighed Slip", True, 
                                "Correctly rejected already weighed slip")
                else:
                    self.log_test("Edge Case - Already Weighed Slip", False, 
                                f"Expected 400 with 'already weighed', got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_test("Edge Case - Already Weighed Slip", False, f"Request failed: {str(e)}")
        
        # Test 3: Gross weight <= Tare weight
        if self.created_slips and len(self.created_slips) > 1:
            invalid_weight_payload = {
                "slip_id": self.created_slips[1] if len(self.created_slips) > 1 else "WB-25-000002",
                "vehicle_number": "MP09TEST777",
                "vehicle_type": "Truck",
                "gross_weight": 10000.0,
                "tare_weight": 15000.0,  # Tare > Gross (invalid)
                "operator_id": "op_003",
                "operator_name": "Test Operator 3"
            }
            
            try:
                response = requests.post(f"{self.base_url}/weighbridge-entry", 
                                       json=invalid_weight_payload, 
                                       headers={'Content-Type': 'application/json'},
                                       timeout=10)
                
                if response.status_code == 400:
                    self.log_test("Edge Case - Invalid Weight", True, 
                                "Correctly rejected tare > gross weight")
                else:
                    self.log_test("Edge Case - Invalid Weight", False, 
                                f"Expected 400, got {response.status_code}")
                    
            except Exception as e:
                self.log_test("Edge Case - Invalid Weight", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Universal Weighbridge System Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 70)
        
        # Setup
        if not self.setup_test_data():
            print("❌ Test setup failed. Exiting.")
            return False
        
        # Run tests in order
        self.test_pre_entry_farmer_purchase()
        self.test_pre_entry_internal_transfer()
        self.test_weighbridge_entry_creation()
        self.test_weighbridge_entry_fetch()
        self.test_farmer_auto_creation_conflict()
        self.test_list_endpoints()
        self.test_slip_id_sequential_generation()
        self.test_edge_cases()
        
        # Summary
        print("=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
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
        
        print("\n" + "=" * 70)
        return failed_tests == 0

if __name__ == "__main__":
    tester = UniversalWeighbridgeTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)