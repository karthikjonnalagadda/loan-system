# inspect_model.py
import joblib, os, pprint
import pandas as pd

p = os.path.join("models", "xgb_loan_model.joblib")
print("Path:", p)
print("Exists:", os.path.exists(p))

mdl = joblib.load(p)
print("Loaded type:", type(mdl))

# pipeline steps
steps = list(getattr(mdl, "named_steps", {}).keys())
print("Pipeline steps:", steps)

# try to extract columns from ColumnTransformer inside the 'pre' step (best-effort)
expected_cols = []
pre = None
if 'pre' in getattr(mdl, "named_steps", {}):
    pre = mdl.named_steps['pre']
elif 'preprocessor' in getattr(mdl, "named_steps", {}):
    pre = mdl.named_steps['preprocessor']

if pre is not None and hasattr(pre, "transformers_"):
    for name, transformer, cols in pre.transformers_:
        try:
            if isinstance(cols, (list, tuple)):
                expected_cols.extend(list(cols))
        except Exception:
            pass

# de-duplicate and print
seen = set()
ordered = []
for c in expected_cols:
    if c not in seen:
        seen.add(c)
        ordered.append(c)

print("Example expected columns (first 80):")
pprint.pprint(ordered[:80])

# quick sample prediction test that fills missing columns with zeros
print("\nQuick smoke test: building a full row with zeros for expected columns (real values for common names)")
row = {}
if ordered:
    for c in ordered:
        # fill with 0 for numeric-looking columns, else 'missing'
        if any(tok in c.lower() for tok in ['amount','income','score','age','count','num','loan','balance','debt','ratio','rate']):
            row[c] = 0
        else:
            row[c] = 'missing'
else:
    # fallback small sample (if we couldn't get expected names)
    row = {"CreditScore":700, "Income":50000, "LoanAmount":10000, "Age":30}

print("Sample row keys shown:", list(row.keys())[:20])

X = pd.DataFrame([row])
try:
    pred = mdl.predict(X)
    proba = mdl.predict_proba(X)[:,1]
    print("Predict success. pred:", pred, "proba:", proba)
except Exception as e:
    print("Predict failed (likely feature mismatch). Error:", type(e).__name__, str(e))
