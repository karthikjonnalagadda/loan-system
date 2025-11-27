# backend/app/loan.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
import datetime
from .ml import predict_default

loan_bp = Blueprint("loan", __name__)

@loan_bp.route("/applications", methods=["POST"])
@jwt_required()
def create_application():
    user_id_str = get_jwt_identity()
    if not user_id_str:
        return jsonify({"msg": "invalid token identity"}), 401

    try:
        user_obj_id = ObjectId(user_id_str)
    except Exception:
        return jsonify({"msg": "invalid user id in token"}), 401

    data = request.get_json() or {}

    app_doc = {
        "user_id": user_obj_id,
        "full_name": data.get("full_name"),
        "age": int(data.get("age") or 0),
        "employment_type": data.get("employment_type"),
        "monthly_income": float(data.get("monthly_income") or 0),
        "loan_amount": float(data.get("loan_amount") or 0),
        "loan_purpose": data.get("loan_purpose"),
        "existing_debts": float(data.get("existing_debts") or 0),
        "credit_history_flag": bool(data.get("credit_history_flag", False)),
        "credit_score": data.get("credit_score"),
        "marital_status": data.get("marital_status"),
        "location": data.get("location"),
        "gender": data.get("gender"),
        "ml_score": None,
        "ml_label": None,
        "decision_status": "PENDING",
        "created_at": datetime.datetime.utcnow()
    }

    res = current_app.mongo.loan_applications.insert_one(app_doc)
    app_id = res.inserted_id

    # ML prediction
    try:
        features = {
            "Age": app_doc["age"],
            "Income": app_doc["monthly_income"] * 12,
            "LoanAmount": app_doc["loan_amount"],
            "CreditScore": app_doc.get("credit_score"),
            "EmploymentType": app_doc.get("employment_type"),
            "MaritalStatus": app_doc.get("marital_status"),
            "location": app_doc.get("location"),
            "gender": app_doc.get("gender")
        }

        mlres = predict_default(features)

        current_app.mongo.loan_applications.update_one(
            {"_id": app_id},
            {"$set": {
                "ml_score": mlres["default_probability"],
                "ml_label": mlres["predicted_label"]
            }}
        )
    except Exception as e:
        print("ML prediction error:", e)

    return jsonify({"msg": "Application submitted", "application_id": str(app_id)}), 201


@loan_bp.route("/applications/my", methods=["GET"])
@jwt_required()
def my_applications():
    user_id_str = get_jwt_identity()

    try:
        user_obj_id = ObjectId(user_id_str)
    except Exception:
        return jsonify({"msg": "invalid user id in token"}), 401

    docs = current_app.mongo.loan_applications.find({"user_id": user_obj_id}).sort("created_at", -1)

    out = []
    for d in docs:
        out.append({
            "id": str(d["_id"]),
            "full_name": d.get("full_name"),
            "loan_amount": d.get("loan_amount"),
            "created_at": d.get("created_at").isoformat() if d.get("created_at") else None,
            "ml_score": d.get("ml_score"),
            "ml_label": d.get("ml_label"),
            "decision_status": d.get("decision_status")
        })

    return jsonify(out), 200
