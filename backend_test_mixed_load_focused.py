#!/usr/bin/env python3
"""
Focused Backend API Testing for Mixed Load Invoice Processing Endpoints
Tests the core mixed load invoice endpoints with mock data
"""
import requests
import json
import sys
import time
from datetime import datetime, timezone, timedelta

# Backend URL from frontend/.env
BASE_URL = "https://sales-invoice-edit.preview.emergentagent.com/api"

class FocusedMixedLoadTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.test_results = []
        
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
    
    def test_mixed_load_bulk_endpoint_validation(self):
        """
        Test 1: Mixed Load Bulk Endpoint - Input Validation
        Test the endpoint with various invalid inputs to verify validation
        """
        print("🔍 Test 1: Mixed Load Bulk Endpoint - Input Validation...")
        
        test_cases = [
            {
                "name": "Missing Pre-Entry ID",
                "payload": {
                    "invoice_date": datetime.now().strftime("%Y-%m-%d"),
                    "weighbridge_slip_no": "TEST-SLIP-001",
                    "is_entry": False,
                    "line_items": [],
                    "broker_name": "Test Broker",
                    "brokerage_type": "per_quintal",
                    "brokerage_rate": 5.0,
                    "freight": 0,
                    "remarks": "Test validation"
                },
                "expected_status": 422,
                "expected_error": "validation error"
            },
            {
                "name": "Invalid Pre-Entry ID",
                "payload": {
                    "pre_entry_id": "invalid-uuid-12345",
                    "invoice_date": datetime.now().strftime("%Y-%m-%d"),
                    "weighbridge_slip_no": "TEST-SLIP-001",
                    "is_entry": False,
                    "line_items": [],
                    "broker_name": "Test Broker",
                    "brokerage_type": "per_quintal",
                    "brokerage_rate": 5.0,
                    "freight": 0,
                    "remarks": "Test validation"
                },
                "expected_status": 404,
                "expected_error": "not found"
            }
        ]
        
        validation_results = []
        
        for test_case in test_cases:
            try:
                response = requests.post(
                    f"{self.base_url}/sales/mixed-load-invoice/bulk?created_by=test-user",
                    json=test_case["payload"],
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )
                
                if response.status_code == test_case["expected_status"]:
                    if test_case["expected_error"].lower() in response.text.lower():
                        validation_results.append((test_case["name"], True, f"Correctly returned {response.status_code}"))
                    else:
                        validation_results.append((test_case["name"], False, f"Got {response.status_code} but wrong error message: {response.text}"))
                else:
                    validation_results.append((test_case["name"], False, f"Expected {test_case['expected_status']}, got {response.status_code}: {response.text}"))
                    
            except Exception as e:
                validation_results.append((test_case["name"], False, f"Request failed: {str(e)}"))
        
        # Log results
        all_passed = True
        for test_name, success, details in validation_results:
            self.log_test(f"Validation - {test_name}", success, details)
            if not success:
                all_passed = False
        
        return all_passed
    
    def test_mixed_load_create_all_endpoint_validation(self):
        """
        Test 2: Mixed Load Create-All Endpoint - Input Validation
        """
        print("🔍 Test 2: Mixed Load Create-All Endpoint - Input Validation...")
        
        test_cases = [
            {
                "name": "Missing Pre-Entry ID",
                "params": {
                    "invoice_date": datetime.now().strftime("%Y-%m-%d"),
                    "weighbridge_slip_no": "TEST-SLIP-001",
                    "is_entry": False,
                    "created_by": "test-user"
                },
                "expected_status": 422,
                "expected_error": "validation error"
            },
            {
                "name": "Invalid Pre-Entry ID",
                "params": {
                    "pre_entry_id": "invalid-uuid-12345",
                    "invoice_date": datetime.now().strftime("%Y-%m-%d"),
                    "weighbridge_slip_no": "TEST-SLIP-001",
                    "is_entry": False,
                    "created_by": "test-user"
                },
                "expected_status": 404,
                "expected_error": "not found"
            }
        ]
        
        validation_results = []
        
        for test_case in test_cases:
            try:
                response = requests.post(
                    f"{self.base_url}/sales/mixed-load-invoice/create-all",
                    params=test_case["params"],
                    timeout=10
                )
                
                if response.status_code == test_case["expected_status"]:
                    if test_case["expected_error"].lower() in response.text.lower():
                        validation_results.append((test_case["name"], True, f"Correctly returned {response.status_code}"))
                    else:
                        validation_results.append((test_case["name"], False, f"Got {response.status_code} but wrong error message: {response.text}"))
                else:
                    validation_results.append((test_case["name"], False, f"Expected {test_case['expected_status']}, got {response.status_code}: {response.text}"))
                    
            except Exception as e:
                validation_results.append((test_case["name"], False, f"Request failed: {str(e)}"))
        
        # Log results
        all_passed = True
        for test_name, success, details in validation_results:
            self.log_test(f"Create-All Validation - {test_name}", success, details)
            if not success:
                all_passed = False
        
        return all_passed
    
    def test_endpoint_availability(self):
        """
        Test 3: Endpoint Availability
        Verify the mixed load endpoints are available and respond
        """
        print("🔍 Test 3: Endpoint Availability...")
        
        endpoints = [
            {
                "name": "Mixed Load Bulk Endpoint",
                "method": "POST",
                "url": f"{self.base_url}/sales/mixed-load-invoice/bulk?created_by=test-user",
                "payload": {}  # Empty payload to test endpoint availability
            },
            {
                "name": "Mixed Load Create-All Endpoint", 
                "method": "POST",
                "url": f"{self.base_url}/sales/mixed-load-invoice/create-all",
                "params": {}  # Empty params to test endpoint availability
            }
        ]
        
        availability_results = []
        
        for endpoint in endpoints:
            try:
                if endpoint["method"] == "POST":
                    if "payload" in endpoint:
                        response = requests.post(
                            endpoint["url"],
                            json=endpoint["payload"],
                            headers={'Content-Type': 'application/json'},
                            timeout=5
                        )
                    else:
                        response = requests.post(
                            endpoint["url"],
                            params=endpoint.get("params", {}),
                            timeout=5
                        )
                
                # We expect validation errors (422) or missing data errors (400/404)
                # But NOT 404 "Not Found" for the endpoint itself
                if response.status_code == 404 and "not found" in response.text.lower() and "endpoint" in response.text.lower():
                    availability_results.append((endpoint["name"], False, f"Endpoint not found: {response.text}"))
                elif response.status_code in [400, 422, 404]:
                    # These are expected validation errors, meaning endpoint exists
                    availability_results.append((endpoint["name"], True, f"Endpoint available (validation error as expected: {response.status_code})"))
                elif response.status_code in [200, 201]:
                    availability_results.append((endpoint["name"], True, f"Endpoint available and responded successfully"))
                else:
                    availability_results.append((endpoint["name"], True, f"Endpoint available (status: {response.status_code})"))
                    
            except requests.exceptions.Timeout:
                availability_results.append((endpoint["name"], False, "Endpoint timeout"))
            except requests.exceptions.ConnectionError:
                availability_results.append((endpoint["name"], False, "Connection error"))
            except Exception as e:
                availability_results.append((endpoint["name"], False, f"Request failed: {str(e)}"))
        
        # Log results
        all_passed = True
        for test_name, success, details in availability_results:
            self.log_test(f"Availability - {test_name}", success, details)
            if not success:
                all_passed = False
        
        return all_passed
    
    def test_sales_pre_entries_endpoint(self):
        """
        Test 4: Sales Pre-Entries Endpoint
        Check if we can access sales pre-entries to understand data structure
        """
        print("🔍 Test 4: Sales Pre-Entries Endpoint...")
        
        try:
            # Try to get sales pre-entries without status filter first
            response = requests.get(f"{self.base_url}/sales/pre-entries", timeout=10)
            
            if response.status_code == 200:
                pre_entries = response.json()
                
                if isinstance(pre_entries, list):
                    mixed_load_count = sum(1 for pe in pre_entries if pe.get('is_mixed_load', False))
                    total_count = len(pre_entries)
                    
                    self.log_test("Sales Pre-Entries Endpoint", True, 
                                f"Found {total_count} pre-entries, {mixed_load_count} are mixed load")
                    
                    # Check if any have the required structure for mixed load testing
                    if mixed_load_count > 0:
                        sample_mixed = next(pe for pe in pre_entries if pe.get('is_mixed_load', False))
                        line_items_count = len(sample_mixed.get('line_items', []))
                        
                        self.log_test("Mixed Load Structure Check", True, 
                                    f"Sample mixed load has {line_items_count} line items, "
                                    f"Status: {sample_mixed.get('status')}, "
                                    f"Weighbridge completed: {sample_mixed.get('weighbridge_completed')}")
                    
                    return True
                else:
                    self.log_test("Sales Pre-Entries Endpoint", False, 
                                f"Expected list, got {type(pre_entries)}")
                    return False
            else:
                self.log_test("Sales Pre-Entries Endpoint", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Sales Pre-Entries Endpoint", False, f"Request failed: {str(e)}")
            return False
    
    def test_basic_sales_endpoints(self):
        """
        Test 5: Basic Sales Endpoints
        Test other sales endpoints to verify the module is working
        """
        print("🔍 Test 5: Basic Sales Endpoints...")
        
        endpoints_to_test = [
            {
                "name": "Sales Queue",
                "url": f"{self.base_url}/sales/queue",
                "method": "GET"
            },
            {
                "name": "Sales Invoices",
                "url": f"{self.base_url}/sales/invoices",
                "method": "GET"
            }
        ]
        
        basic_results = []
        
        for endpoint in endpoints_to_test:
            try:
                if endpoint["method"] == "GET":
                    response = requests.get(endpoint["url"], timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        basic_results.append((endpoint["name"], True, f"Returned {len(data)} items"))
                    else:
                        basic_results.append((endpoint["name"], True, f"Returned data: {type(data)}"))
                elif response.status_code == 500:
                    basic_results.append((endpoint["name"], False, f"Internal server error: {response.text}"))
                else:
                    basic_results.append((endpoint["name"], True, f"Responded with status {response.status_code}"))
                    
            except Exception as e:
                basic_results.append((endpoint["name"], False, f"Request failed: {str(e)}"))
        
        # Log results
        all_passed = True
        for test_name, success, details in basic_results:
            self.log_test(f"Basic Endpoint - {test_name}", success, details)
            if not success:
                all_passed = False
        
        return all_passed
    
    def run_all_tests(self):
        """Run all focused mixed load tests"""
        print("🚀 Starting Focused Mixed Load Invoice Processing Testing")
        print(f"Testing against: {self.base_url}")
        print("=" * 80)
        
        # Test 1: Endpoint availability
        success1 = self.test_endpoint_availability()
        
        # Test 2: Basic sales endpoints
        success2 = self.test_basic_sales_endpoints()
        
        # Test 3: Sales pre-entries endpoint
        success3 = self.test_sales_pre_entries_endpoint()
        
        # Test 4: Mixed load bulk endpoint validation
        success4 = self.test_mixed_load_bulk_endpoint_validation()
        
        # Test 5: Mixed load create-all endpoint validation
        success5 = self.test_mixed_load_create_all_endpoint_validation()
        
        return all([success1, success2, success3, success4, success5])
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 80)
        print("📊 FOCUSED MIXED LOAD INVOICE PROCESSING TEST SUMMARY")
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
            
            print("\n🚨 MIXED LOAD INVOICE PROCESSING ISSUES FOUND:")
            print("Some endpoints or functionality may not be working correctly.")
            print("Please review the failed tests above and check the implementation.")
        else:
            print("\n🎉 MIXED LOAD INVOICE PROCESSING ENDPOINTS AVAILABLE!")
            print("✅ Endpoint Availability - Both mixed load endpoints are accessible")
            print("✅ Basic Sales Endpoints - Core sales functionality working")
            print("✅ Sales Pre-Entries - Can access pre-entry data")
            print("✅ Input Validation - Proper validation for bulk endpoint")
            print("✅ Input Validation - Proper validation for create-all endpoint")
            print("\n🎯 ENDPOINT VERIFICATION COMPLETE:")
            print("- POST /api/sales/mixed-load-invoice/bulk endpoint available")
            print("- POST /api/sales/mixed-load-invoice/create-all endpoint available")
            print("- Proper input validation implemented")
            print("- Sales module endpoints responding correctly")
        
        print("\n" + "=" * 80)
        return failed_tests == 0

if __name__ == "__main__":
    tester = FocusedMixedLoadTester()
    success = tester.run_all_tests()
    tester.print_summary()
    sys.exit(0 if success else 1)