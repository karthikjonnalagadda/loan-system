#!/usr/bin/env python3
"""
Comprehensive test script for Loan System API workflows
Tests: Registration, Login, Loan Application, Admin Access, ML Prediction
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000"
API_URL = f"{BASE_URL}/api"

# Colors for output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_test(name):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")
    print(f"{Colors.CYAN}TEST: {name}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.ENDC}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.ENDC}")

def print_info(msg):
    print(f"{Colors.YELLOW}ℹ {msg}{Colors.ENDC}")

def print_json(data, label="Response"):
    print(f"{Colors.CYAN}{label}:{Colors.ENDC}")
    print(json.dumps(data, indent=2))

# Test results
results = {
    "passed": 0,
    "failed": 0,
    "tests": []
}

def test_result(name, passed, error=None):
    results["tests"].append({
        "name": name,
        "passed": passed,
        "error": error
    })
    if passed:
        results["passed"] += 1
        print_success(name)
    else:
        results["failed"] += 1
        print_error(name)
        if error:
            print_info(f"Error: {error}")

# Test 1: Health Check
def test_health():
    print_test("Health Check")
    try:
        resp = requests.get(f"{API_URL}/auth/health")
        if resp.status_code == 200:
            data = resp.json()
            print_json(data)
            test_result("Health check endpoint", True)
            return True
        else:
            test_result("Health check endpoint", False, f"Status {resp.status_code}")
            return False
    except Exception as e:
        test_result("Health check endpoint", False, str(e))
        return False

# Test 2: User Registration
def test_registration():
    print_test("User Registration")
    
    test_email = f"testuser_{int(time.time())}@example.com"
    payload = {
        "email": test_email,
        "name": "Test User",
        "password": "TestPassword123!"
    }
    
    try:
        resp = requests.post(f"{API_URL}/auth/register", json=payload)
        
        if resp.status_code == 201:
            data = resp.json()
            print_json(data)
            
            # Check required fields
            if "access_token" in data and "role" in data:
                test_result("User registration", True)
                return data["access_token"], test_email
            else:
                test_result("User registration", False, "Missing token or role in response")
                return None, None
        else:
            test_result("User registration", False, f"Status {resp.status_code}: {resp.text}")
            return None, None
    except Exception as e:
        test_result("User registration", False, str(e))
        return None, None

# Test 3: User Login
def test_login(email):
    print_test("User Login")
    
    payload = {
        "email": email,
        "password": "TestPassword123!"
    }
    
    try:
        resp = requests.post(f"{API_URL}/auth/login", json=payload)
        
        if resp.status_code == 200:
            data = resp.json()
            print_json(data)
            
            if "access_token" in data:
                test_result("User login", True)
                return data["access_token"]
            else:
                test_result("User login", False, "Missing token in response")
                return None
        else:
            test_result("User login", False, f"Status {resp.status_code}: {resp.text}")
            return None
    except Exception as e:
        test_result("User login", False, str(e))
        return None

# Test 4: ML Prediction
def test_prediction():
    print_test("ML Prediction")
    
    payload = {
        "Age": 35,
        "Income": 60000,
        "LoanAmount": 200000,
        "CreditScore": 650,
        "EmploymentType": "Salaried",
        "MaritalStatus": "Married",
        "location": "Mumbai",
        "gender": "Male"
    }
    
    try:
        resp = requests.post(f"{API_URL}/predict", json=payload)
        
        if resp.status_code == 200:
            data = resp.json()
            print_json(data)
            
            if "predicted_label" in data and "default_probability" in data:
                test_result("ML prediction", True)
                return data
            else:
                test_result("ML prediction", False, "Missing prediction fields")
                return None
        else:
            test_result("ML prediction", False, f"Status {resp.status_code}: {resp.text}")
            return None
    except Exception as e:
        test_result("ML prediction", False, str(e))
        return None

# Test 5: Loan Application Submission
def test_loan_application(token, ml_result):
    print_test("Loan Application Submission")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "full_name": "Test Applicant",
        "age": 35,
        "employment_type": "Salaried",
        "monthly_income": 5000,
        "Income": 60000,
        "loan_amount": 200000,
        "loan_purpose": "Home",
        "existing_debts": 50000,
        "credit_history_flag": False,
        "credit_score": 650,
        "marital_status": "Married",
        "location": "Mumbai",
        "gender": "Male"
    }
    
    try:
        resp = requests.post(f"{API_URL}/loan/applications", json=payload, headers=headers)
        
        if resp.status_code == 201:
            data = resp.json()
            print_json(data)
            
            if "application_id" in data:
                test_result("Loan application submission", True)
                return data.get("application_id")
            else:
                test_result("Loan application submission", False, "Missing application_id")
                return None
        else:
            test_result("Loan application submission", False, f"Status {resp.status_code}: {resp.text}")
            return None
    except Exception as e:
        test_result("Loan application submission", False, str(e))
        return None

# Test 6: Retrieve User's Applications
def test_get_user_applications(token):
    print_test("Retrieve User's Applications")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.get(f"{API_URL}/loan/applications/my", headers=headers)
        
        if resp.status_code == 200:
            data = resp.json()
            print_json(data, "User's Applications")
            
            if isinstance(data, list) and len(data) > 0:
                app = data[0]
                
                # Check for ML fields
                if "ml_score" in app and "ml_label" in app:
                    if app["ml_score"] is not None:
                        test_result("User applications retrieved with ML scores", True)
                        return True
                    else:
                        test_result("User applications retrieved (no ML scores yet)", True)
                        return True
                else:
                    test_result("User applications retrieved", True)
                    return True
            else:
                test_result("User applications retrieved (empty list)", True)
                return True
        else:
            test_result("Retrieve user applications", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        test_result("Retrieve user applications", False, str(e))
        return False

# Test 7: Admin Registration & Access
def test_admin_access():
    print_test("Admin Dashboard Access")
    
    # Register admin user
    admin_email = f"admin_{int(time.time())}@example.com"
    admin_payload = {
        "email": admin_email,
        "name": "Test Admin",
        "password": "AdminPassword123!"
    }
    
    try:
        # Register
        reg_resp = requests.post(f"{API_URL}/auth/register", json=admin_payload)
        if reg_resp.status_code != 201:
            test_result("Admin registration", False, f"Status {reg_resp.status_code}")
            return False
        
        admin_token = reg_resp.json().get("access_token")
        print_info(f"Registered admin user: {admin_email}")
        
        # Try to access admin endpoint (will fail due to role check)
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{API_URL}/admin/loan/applications", headers=headers)
        
        # Expected to fail with 403 (not admin role)
        if resp.status_code == 403:
            test_result("Admin role check (correctly rejected non-admin)", True)
            print_info("Note: User needs admin role in database to access admin endpoints")
            print_info("Run: python backend/create_admin_mongo.py to create admin user")
            return False
        elif resp.status_code == 200:
            data = resp.json()
            print_json(data, "Admin Applications")
            test_result("Admin endpoint access", True)
            return True
        else:
            test_result("Admin endpoint access", False, f"Status {resp.status_code}")
            return False
            
    except Exception as e:
        test_result("Admin access test", False, str(e))
        return False

# Test 8: Test Authorization (Missing Token)
def test_authorization():
    print_test("Authorization Check (Missing Token)")
    
    try:
        # Try to access protected endpoint without token
        resp = requests.get(f"{API_URL}/loan/applications/my")
        
        if resp.status_code == 401:
            test_result("Authorization header required", True)
            print_info("Correctly rejected request without authorization header")
        else:
            test_result("Authorization header required", False, f"Expected 401, got {resp.status_code}")
            
    except Exception as e:
        test_result("Authorization check", False, str(e))

# Main test runner
def run_all_tests():
    print(f"\n{Colors.BOLD}{Colors.HEADER}")
    print("="*60)
    print("LOAN SYSTEM API - COMPREHENSIVE TEST SUITE")
    print("="*60)
    print(f"{Colors.ENDC}")
    
    print_info(f"Testing: {BASE_URL}")
    print_info(f"Start time: {datetime.now().isoformat()}")
    
    # Wait for server to be ready
    print_info("Waiting for server to be ready...")
    for attempt in range(5):
        try:
            resp = requests.get(f"{API_URL}/auth/health", timeout=2)
            if resp.status_code == 200:
                print_success("Server is ready")
                break
        except:
            pass
        
        if attempt < 4:
            time.sleep(1)
        else:
            print_error("Server is not responding. Make sure backend is running!")
            print_info("Start backend with: python backend/run.py")
            return
    
    # Run tests in order
    test_health()
    
    token, email = test_registration()
    if token:
        test_login(email)
        
        ml_result = test_prediction()
        
        app_id = test_loan_application(token, ml_result)
        
        # Give server time to process
        time.sleep(1)
        
        test_get_user_applications(token)
    
    test_admin_access()
    test_authorization()
    
    # Print summary
    print(f"\n{Colors.BOLD}{Colors.HEADER}")
    print("="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"{Colors.ENDC}")
    
    total = results["passed"] + results["failed"]
    pass_rate = (results["passed"] / total * 100) if total > 0 else 0
    
    print(f"Total Tests: {total}")
    print(f"{Colors.GREEN}Passed: {results['passed']}{Colors.ENDC}")
    print(f"{Colors.RED}Failed: {results['failed']}{Colors.ENDC}")
    print(f"Pass Rate: {pass_rate:.1f}%")
    
    if results["failed"] == 0:
        print(f"\n{Colors.GREEN}{Colors.BOLD}✓ ALL TESTS PASSED!{Colors.ENDC}")
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}✗ SOME TESTS FAILED{Colors.ENDC}")
        print(f"\n{Colors.YELLOW}Failed Tests:{Colors.ENDC}")
        for test in results["tests"]:
            if not test["passed"]:
                print(f"  - {test['name']}")
                if test["error"]:
                    print(f"    Error: {test['error']}")
    
    print(f"\nEnd time: {datetime.now().isoformat()}")

if __name__ == "__main__":
    run_all_tests()
