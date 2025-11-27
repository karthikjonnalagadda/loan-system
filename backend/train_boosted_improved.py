# train_boosted_improved.py
# Improves baseline by feature engineering + imbalance handling + randomized search.
import os, json, joblib, time
import pandas as pd, numpy as np
from sklearn.model_selection import train_test_split, StratifiedKFold, RandomizedSearchCV
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score, recall_score, precision_score
from xgboost import XGBClassifier
from scipy.stats import randint, uniform

# optional imblearn
USE_SMOTE = False
try:
    from imblearn.over_sampling import SMOTE
    from imblearn.pipeline import Pipeline as ImbPipeline
    USE_SMOTE = True
except Exception:
    from sklearn.pipeline import Pipeline as ImbPipeline

# CONFIG
CSV_PATH = r"C:\Users\karth\Downloads\Loan_default.csv"
OUT_MODEL = os.path.join(os.path.dirname(__file__), "models", "xgb_improved.joblib")
REPORT_PATH = os.path.join(os.path.dirname(__file__), "models", "training_report_boosted.json")
SAMPLE_NROWS = None   # set an int for quick runs
RNG = 42
N_TRIALS = 20         # lower for speed; increase to 50+ for better search
CV_FOLDS = 3
N_JOBS = -1

os.makedirs(os.path.dirname(OUT_MODEL), exist_ok=True)

print("Loading data...")
df = pd.read_csv(CSV_PATH, nrows=SAMPLE_NROWS, low_memory=True) if SAMPLE_NROWS else pd.read_csv(CSV_PATH, low_memory=True)

# detect target column
candidates = ['Default','default','loan_default','LoanDefault','Label','label','target','is_default']
target_col = next((c for c in candidates if c in df.columns), None)
if target_col is None:
    last = df.columns[-1]
    target_col = last if df[last].nunique() <= 5 else None
if target_col is None:
    raise RuntimeError("Set target_col variable manually in script")
print("Target:", target_col)

# ========== Feature engineering (easy wins) ==========
df = df.copy()
# drop ID
id_cols = [c for c in df.columns if 'id' in c.lower()]
df = df.drop(columns=id_cols, errors='ignore')

# loan_to_income
if 'LoanAmount' in df.columns and 'Income' in df.columns:
    df['loan_to_income'] = df['LoanAmount'] / df['Income'].replace(0, np.nan)
    df['loan_to_income'] = df['loan_to_income'].fillna(0)

# simple DTI if MonthlyDebt exists
if 'MonthlyDebt' in df.columns and 'Income' in df.columns:
    df['dti'] = df['MonthlyDebt'] / df['Income'].replace(0, np.nan)
    df['dti'] = df['dti'].fillna(0)

# credit bins
if 'CreditScore' in df.columns:
    bins = [0, 580, 670, 740, 800, 1000]
    labels = ['poor','fair','good','very_good','excellent']
    df['credit_bin'] = pd.cut(df['CreditScore'], bins=bins, labels=labels).astype(object)

# flag examples
for col in ['HasDependents','HasCoSigner','HasCosigner','Has_Cosigner']:
    if col in df.columns:
        df['has_cosigner_flag'] = df[col].astype(str).str.lower().isin(['1','yes','true','y']).astype(int)
        break
# if employment field exists
for col in ['EmploymentType','EmploymentStatus','Employment']:
    if col in df.columns:
        df['is_salaried'] = df[col].astype(str).str.lower().str.contains('salar').astype(int)
        break

# ======= Prepare X, y =======
y = df[target_col]
X = df.drop(columns=[target_col])

# drop high-missing columns
drop_cols = X.columns[X.isna().mean() > 0.9].tolist()
if drop_cols:
    X = X.drop(columns=drop_cols)

# split numeric/categorical
num_cols = X.select_dtypes(include=['number']).columns.tolist()
cat_cols = X.select_dtypes(include=['object','category','bool']).columns.tolist()
print("Numeric:", len(num_cols), "Categorical:", len(cat_cols))

# Preprocessing
num_pipe = Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler(with_mean=False))])
cat_pipe = Pipeline([('imputer', SimpleImputer(strategy='most_frequent')), ('ohe', OneHotEncoder(handle_unknown='ignore', sparse_output=True))])
pre = ColumnTransformer([('num', num_pipe, num_cols), ('cat', cat_pipe, cat_cols)], sparse_threshold=0.3)

# encode target binary
def encode_target(s):
    if s.dtype=='object' or s.dtype.name=='category' or s.dtype==bool:
        return s.astype(str).str.lower().isin(['1','yes','y','true','t','default','d']).astype(int)
    if s.nunique()==2:
        vals = sorted(s.unique()); return (s==vals[1]).astype(int)
    return (s > s.median()).astype(int)

y_enc = encode_target(y)
print("Positive ratio:", float(y_enc.mean()))

# train/holdout split
X_train, X_hold, y_train, y_hold = train_test_split(X, y_enc, test_size=0.2, random_state=RNG, stratify=y_enc)
print("Train/hold sizes:", X_train.shape, X_hold.shape)

# model
base = XGBClassifier(use_label_encoder=False, eval_metric='logloss', n_jobs=4, random_state=RNG)

# param space (search on clf__*)
param_dist = {
    'clf__n_estimators': randint(100, 600),
    'clf__max_depth': randint(3, 10),
    'clf__learning_rate': uniform(0.01, 0.25),
    'clf__subsample': uniform(0.6, 0.4),
    'clf__colsample_bytree': uniform(0.6, 0.4),
    'clf__min_child_weight': randint(1, 10)
}

# pipeline assembly (with SMOTE if available)
if USE_SMOTE:
    print("Using SMOTE in pipeline.")
    pipeline = ImbPipeline([('pre', pre), ('smote', SMOTE(random_state=RNG)), ('clf', base)])
else:
    # set initial scale_pos_weight heuristic
    neg = int((y_train==0).sum()); pos = int((y_train==1).sum())
    scale_pos = (neg/pos) if pos>0 else 1.0
    base.set_params(scale_pos_weight=scale_pos)
    pipeline = Pipeline([('pre', pre), ('clf', base)])
    print("SMOTE not available. Using scale_pos_weight:", scale_pos)

# RandomizedSearchCV
cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RNG)
rs = RandomizedSearchCV(pipeline, param_distributions=param_dist, n_iter=N_TRIALS, scoring='roc_auc',
                        n_jobs=N_JOBS, cv=cv, verbose=2, random_state=RNG, refit=True)

print("Starting search (trials=", N_TRIALS, ")")
t0 = time.time()
rs.fit(X_train, y_train)
t1 = time.time()
print("Search time (s):", t1-t0)
print("Best CV AUC:", rs.best_score_)
print("Best params:", rs.best_params_)

# Evaluate on holdout
best = rs.best_estimator_
y_pred = best.predict(X_hold)
y_proba = best.predict_proba(X_hold)[:,1]
acc = accuracy_score(y_hold, y_pred)
auc = roc_auc_score(y_hold, y_proba)
rec = recall_score(y_hold, y_pred)
prec = precision_score(y_hold, y_pred)
print("Holdout — Acc:%.4f AUC:%.4f Recall:%.4f Precision:%.4f" % (acc, auc, rec, prec))
print(classification_report(y_hold, y_pred))

# try lowering threshold to increase recall (show a few options)
for t in [0.5, 0.4, 0.35, 0.3, 0.25]:
    p = (y_proba >= t).astype(int)
    print(f"Threshold {t}: Acc {accuracy_score(y_hold,p):.4f}, Recall {recall_score(y_hold,p):.4f}, Precision {precision_score(y_hold,p):.4f}")

# save model
joblib.dump(best, OUT_MODEL)
print("Saved model to", OUT_MODEL)

# save report
report = {
    "best_cv_auc": float(rs.best_score_),
    "holdout_acc": float(acc),
    "holdout_auc": float(auc),
    "holdout_recall": float(rec),
    "best_params": rs.best_params_,
    "search_time_seconds": float(t1-t0)
}
with open(REPORT_PATH, "w") as fh:
    json.dump(report, fh, indent=2)
print("Saved report to", REPORT_PATH)
