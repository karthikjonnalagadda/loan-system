# backend/app/ml.py

import os
import threading
import joblib
import pandas as pd
import numpy as np


# ----------------------------------------------------------------------
# MODEL PATH & GLOBALS
# ----------------------------------------------------------------------

BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "..", "models", "xgb_loan_model.joblib")

_model = None
_lock = threading.Lock()


# ----------------------------------------------------------------------
# INTERNAL: LOAD MODEL FROM DISK
# ----------------------------------------------------------------------

def _load_model_from_disk(path):
    try:
        obj = joblib.load(path)
        print(f"[ml] Loaded real model from {path}")
        return obj
    except Exception as e:
        print(f"[ml] ERROR loading model: {type(e).__name__}: {e}")
        return None


# ----------------------------------------------------------------------
# PUBLIC: GET MODEL (LAZY LOAD)
# ----------------------------------------------------------------------

def get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:

                # Real model exists?
                if os.path.exists(MODEL_PATH):
                    m = _load_model_from_disk(MODEL_PATH)
                    if m is not None:
                        _model = m
                        return _model
                    else:
                        print("[ml] Failed to load real model. Using dummy.")

                # Fallback dummy model
                from sklearn.dummy import DummyClassifier
                dummy = DummyClassifier(strategy="most_frequent")
                dummy.fit([[0]], [0])
                _model = dummy
                print("[ml] Loaded dummy classifier.")

    return _model


# ----------------------------------------------------------------------
# COMPAT WRAPPER (some files import load_model())
# ----------------------------------------------------------------------
def load_model():
    return get_model()


# ----------------------------------------------------------------------
# HELPERS: extract expected columns from preprocessor
# ----------------------------------------------------------------------

def _get_expected_columns_from_preprocessor(model):
    """
    Try to extract the names of original input columns expected by the 'pre' (ColumnTransformer).
    """
    cols = []
    pre = None

    try:
        # For XGBoost/sklearn pipelines, try multiple paths
        if hasattr(model, "named_steps"):
            # Standard sklearn Pipeline
            if 'pre' in model.named_steps:
                pre = model.named_steps['pre']
            elif 'preprocessor' in model.named_steps:
                pre = model.named_steps['preprocessor']
            elif 'clf' in model.named_steps:
                clf = model.named_steps['clf']
                # Try to get feature names from classifier
                if hasattr(clf, 'n_features_in_'):
                    print(f"[ml] Model expects {clf.n_features_in_} features")
                if hasattr(clf, 'feature_names_in_'):
                    return list(clf.feature_names_in_)
        
        # Try direct booster access (XGBoost)
        if hasattr(model, 'get_booster'):
            booster = model.get_booster()
            if hasattr(booster, 'feature_names'):
                return booster.feature_names
        
        # Extract column names from ColumnTransformer if found
        if pre is not None and hasattr(pre, "transformers_"):
            for _, _, cols_spec in pre.transformers_:
                if isinstance(cols_spec, list) or isinstance(cols_spec, tuple):
                    cols.extend(list(cols_spec))
        
        # Try feature_names_in_ directly
        if hasattr(model, 'feature_names_in_'):
            cols = list(model.feature_names_in_)

    except Exception as e:
        print(f"[ml] Error extracting columns: {e}")

    # Remove duplicates while keeping order
    seen = set()
    ordered = []
    for c in cols:
        if c not in seen:
            seen.add(c)
            ordered.append(c)

    if ordered:
        print(f"[ml] Extracted expected columns: {ordered}")
    
    return ordered


# ----------------------------------------------------------------------
# HELPERS: fill missing values using defaults or fallback heuristics
# ----------------------------------------------------------------------

def _fill_row_with_defaults(row_dict, expected_cols, num_defaults, cat_defaults):
    filled = {}

    for c in expected_cols:

        if c in row_dict:
            # User provided value
            filled[c] = row_dict[c]
            continue

        # Default → numeric
        if c in num_defaults:
            filled[c] = num_defaults[c]
            continue

        # Default → categorical
        if c in cat_defaults:
            filled[c] = cat_defaults[c]
            continue

        # Heuristic fallback
        if any(tok in c.lower() for tok in
               ['amount','income','score','age','months','num','interest',
                'term','dti','loan','ratio','monthly','count','balance']):
            filled[c] = 0.0
        else:
            filled[c] = "missing"

    return filled


# ----------------------------------------------------------------------
# PUBLIC: MAIN PREDICT FUNCTION
# ----------------------------------------------------------------------

def predict_default(input_dict: dict):
    """
    Accepts partial feature dictionary from frontend.
    Returns:
    {
        "predicted_label": int,
        "default_probability": float
    }
    """

    model = get_model()

    # ------------------------------------------------------------------
    # Load defaults JSON (medians + modes)
    # ------------------------------------------------------------------
    defaults_path = os.path.join(BASE_DIR, "..", "models", "feature_defaults.json")
    num_defaults = {}
    cat_defaults = {}

    if os.path.exists(defaults_path):
        try:
            import json
            with open(defaults_path, "r", encoding="utf-8") as fh:
                d = json.load(fh)
            num_defaults = d.get("numeric", {}) or {}
            cat_defaults = d.get("categorical", {}) or {}
            print("[ml] Loaded feature defaults.")
        except Exception as e:
            print("[ml] ERROR reading feature_defaults.json. Using fallback defaults:", e)

    # ------------------------------------------------------------------
    # Obtain expected columns from preprocessor
    # ------------------------------------------------------------------
    expected_cols = _get_expected_columns_from_preprocessor(model)
    
    if not expected_cols:
        # If we can't extract from model, use defaults file keys + input keys
        expected_cols = list(set(list(num_defaults.keys()) + list(cat_defaults.keys()) + list(input_dict.keys())))
        print(f"[ml] Using fallback columns: {expected_cols}")

    if expected_cols:
        row = _fill_row_with_defaults(input_dict, expected_cols, num_defaults, cat_defaults)
    else:
        # No expected columns → use provided fields directly
        row = dict(input_dict)
    
    print(f"[ml] Input: {input_dict}")
    print(f"[ml] Row after defaults: {row}")

    X = pd.DataFrame([row])

    # ------------------------------------------------------------------
    # Prediction logic — skip SMOTE at prediction
    # ------------------------------------------------------------------
    try:
        # If pipeline contains SMOTE, manually pre → clf
        if hasattr(model, "named_steps") and 'smote' in model.named_steps:
            pre = model.named_steps.get('pre', None)
            clf = model.named_steps.get('clf', None)

            if pre is not None and clf is not None:
                X_trans = pre.transform(X)
                proba = float(clf.predict_proba(X_trans)[:, 1][0])
                pred = int(clf.predict(X_trans)[0])
            else:
                # fallback — try pipeline directly
                proba = float(model.predict_proba(X)[:, 1][0])
                pred = int(model.predict(X)[0])

        else:
            # Normal pipeline
            proba = float(model.predict_proba(X)[:, 1][0])
            pred = int(model.predict(X)[0])

    except Exception as e:
        # Fallback
        print("[ml] Predict error:", type(e).__name__, str(e))
        import traceback
        traceback.print_exc()
        try:
            pred = int(model.predict(X)[0])
            proba = float(pred)
        except Exception as e2:
            print("[ml] Fallback predict also failed:", e2)
            pred = 0
            proba = 0.0

    print(f"[ml] Result: pred={pred}, proba={proba}")
    return {
        "predicted_label": pred,
        "default_probability": proba
    }

