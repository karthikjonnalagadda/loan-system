from . import db
from datetime import datetime

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120))
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)  # nullable for Google accounts
    auth_provider = db.Column(db.String(50), default="email")  # "email" or "google"
    role = db.Column(db.String(20), default="user")  # "user" or "admin"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class LoanApplication(db.Model):
    __tablename__ = "loan_applications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    full_name = db.Column(db.String(200))
    age = db.Column(db.Integer)
    employment_type = db.Column(db.String(100))
    monthly_income = db.Column(db.Float)
    loan_amount = db.Column(db.Float)
    loan_purpose = db.Column(db.String(255))
    existing_debts = db.Column(db.Float)
    credit_history_flag = db.Column(db.Boolean, default=False)
    # add other fields required by model...
    ml_score = db.Column(db.Float, nullable=True)
    ml_label = db.Column(db.String(50), nullable=True)
    decision_status = db.Column(db.String(20), default="PENDING")  # PENDING / APPROVED / REJECTED
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="applications")
