#!/usr/bin/env python
"""Debug script to inspect the loaded ML model"""

import sys
import json
from app.ml import get_model, predict_default, _get_expected_columns_from_preprocessor

# Load the model
print("=" * 60)
print("Loading model...")
model = get_model()

print(f"Model type: {type(model)}")
print(f"Model: {model}")

# Try to extract columns
print("\n" + "=" * 60)
print("Extracting expected columns...")
cols = _get_expected_columns_from_preprocessor(model)
print(f"Expected columns: {cols}")

# Test prediction
print("\n" + "=" * 60)
print("Testing prediction...")

test_input = {
    "Age": 35,
    "Income": 60000,
    "LoanAmount": 200000,
    "CreditScore": 650,
    "EmploymentType": "Salaried",
    "MaritalStatus": "Married",
    "location": "Mumbai",
    "gender": "Male"
}

print(f"Input: {test_input}")

try:
    result = predict_default(test_input)
    print(f"Result: {result}")
    print(f"Result JSON: {json.dumps(result)}")
except Exception as e:
    import traceback
    print(f"Error: {e}")
    traceback.print_exc()

print("\n" + "=" * 60)
