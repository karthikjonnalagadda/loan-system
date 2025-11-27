from flask import Blueprint, request, jsonify
from .ml import predict_default

bp = Blueprint("predict", __name__, url_prefix="/api")

@bp.route("/predict", methods=["POST"])
def route_predict():
    try:
        data = request.get_json(force=True) or {}
        out = predict_default(data)
        return jsonify(out), 200
    except Exception as e:
        print("Predict error:", e)
        return jsonify({"message": "ML prediction failed", "error": str(e)}), 500
