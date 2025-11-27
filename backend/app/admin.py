# backend/app/admin.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from bson import ObjectId

admin_bp = Blueprint("admin", __name__)

def _is_admin():
    claims = get_jwt()
    return claims and claims.get("role") == "admin"

@admin_bp.route("/loan/applications", methods=["GET"])
@jwt_required()
def list_applications():
    if not _is_admin():
        return jsonify({"msg":"forbidden"}), 403
    docs = current_app.mongo.loan_applications.find().sort("created_at", -1)
    out = []
    for d in docs:
        out.append({
            "id": str(d["_id"]),
            "user_id": str(d.get("user_id")) if d.get("user_id") else None,
            "full_name": d.get("full_name"),
            "monthly_income": d.get("monthly_income"),
            "loan_amount": d.get("loan_amount"),
            "created_at": d.get("created_at").isoformat() if d.get("created_at") else None,
            "ml_score": d.get("ml_score"),
            "ml_label": d.get("ml_label"),
            "decision_status": d.get("decision_status")
        })
    return jsonify(out)

@admin_bp.route("/loan/applications/<string:app_id>/decision", methods=["PATCH"])
@jwt_required()
def decide(app_id):
    if not _is_admin():
        return jsonify({"msg":"forbidden"}), 403

    data = request.get_json() or {}
    status = data.get("status")
    if status not in ("APPROVED", "REJECTED"):
        return jsonify({"msg":"invalid status"}), 400

    try:
        oid = ObjectId(app_id)
    except Exception:
        return jsonify({"msg":"invalid application id"}), 400

    res = current_app.mongo.loan_applications.update_one(
        {"_id": oid},
        {"$set": {"decision_status": status}}
    )
    if res.matched_count == 0:
        return jsonify({"msg":"not found"}), 404
    return jsonify({"msg":"updated", "id": app_id, "status": status})
