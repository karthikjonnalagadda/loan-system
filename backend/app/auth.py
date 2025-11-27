# backend/app/auth.py
from flask import Blueprint, request, jsonify, current_app, redirect
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token
from bson import ObjectId
import datetime
import os
import requests
from urllib.parse import urlencode

auth_bp = Blueprint("auth", __name__)

def _user_to_public(user_doc):
    return {
        "id": str(user_doc.get("_id")),
        "name": user_doc.get("name"),
        "email": user_doc.get("email"),
        "role": user_doc.get("role"),
        "auth_provider": user_doc.get("auth_provider"),
        "created_at": user_doc.get("created_at").isoformat() if user_doc.get("created_at") else None
    }

# -----------------------
# Health Check
# -----------------------
@auth_bp.route("/health", methods=["GET"])
def health():
    """Health check endpoint for monitoring and k8s probes"""
    try:
        # Check MongoDB connection
        current_app.mongo.command('ping')
        return jsonify({"status": "ok", "service": "auth"}), 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return jsonify({"status": "error", "service": "auth", "error": str(e)}), 503

# -----------------------
# Email/password flows
# -----------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email")
    name = data.get("name", "")
    password = data.get("password")
    if not email or not password:
        return jsonify({"msg":"email and password required"}), 400

    users = current_app.mongo.users
    if users.find_one({"email": email}):
        return jsonify({"msg":"email exists"}), 400

    pw_hash = generate_password_hash(password)
    user = {
        "name": name,
        "email": email,
        "password_hash": pw_hash,
        "auth_provider": "email",
        "role": "user",
        "created_at": datetime.datetime.utcnow()
    }
    res = users.insert_one(user)
    user["_id"] = res.inserted_id

    identity_str = str(user["_id"])
    token = create_access_token(identity=identity_str, additional_claims={"role": user["role"]})

    return jsonify({"access_token": token, "role": user["role"], "user": _user_to_public(user)}), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"msg":"email and password required"}), 400

    users = current_app.mongo.users
    user = users.find_one({"email": email})
    if not user or not user.get("password_hash") or not check_password_hash(user.get("password_hash"), password):
        return jsonify({"msg":"invalid credentials"}), 401

    identity_str = str(user["_id"])
    token = create_access_token(identity=identity_str, additional_claims={"role": user.get("role", "user")})

    return jsonify({"access_token": token, "role": user.get("role", "user"), "user": _user_to_public(user)})

# -----------------------
# Google OAuth flows
# -----------------------

# GET /api/auth/google/url
# Returns a JSON containing the URL to redirect the browser to Google consent page.
@auth_bp.route("/google/url", methods=["GET"])
def google_url():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    if not client_id or not redirect_uri:
        return jsonify({"msg":"Google OAuth not configured"}), 500

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account"
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return jsonify({"url": url})

# GET /api/auth/google/callback
# Exchange code for tokens, fetch userinfo, create/find user, issue JWT and redirect to frontend.
@auth_bp.route("/google/callback", methods=["GET"])
def google_callback():
    code = request.args.get("code")
    error = request.args.get("error")
    if error:
        return jsonify({"msg":"oauth_error", "error": error}), 400
    if not code:
        return jsonify({"msg":"missing code"}), 400

    # Exchange authorization code for tokens
    token_endpoint = "https://oauth2.googleapis.com/token"
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    data = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }

    try:
        token_resp = requests.post(token_endpoint, data=data, timeout=10)
        token_resp.raise_for_status()
    except Exception as e:
        print("Token exchange error:", e, token_resp.text if 'token_resp' in locals() else "")
        return jsonify({"msg":"token_exchange_failed"}), 500

    tokens = token_resp.json()
    access_token = tokens.get("access_token")
    if not access_token:
        return jsonify({"msg":"no access token in response"}), 500

    # Fetch userinfo
    userinfo_endpoint = "https://www.googleapis.com/oauth2/v3/userinfo"
    try:
        ui_resp = requests.get(userinfo_endpoint, headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
        ui_resp.raise_for_status()
    except Exception as e:
        print("Userinfo error:", e, ui_resp.text if 'ui_resp' in locals() else "")
        return jsonify({"msg":"userinfo_failed"}), 500

    info = ui_resp.json()
    email = info.get("email")
    name = info.get("name") or info.get("given_name") or ""
    google_id = info.get("sub")

    if not email:
        return jsonify({"msg":"google did not return email"}), 400

    users = current_app.mongo.users
    user = users.find_one({"email": email})

    if not user:
        # Create user
        new_user = {
            "name": name,
            "email": email,
            "auth_provider": "google",
            "role": "user",
            "created_at": datetime.datetime.utcnow(),
            "google_id": google_id
        }
        res = users.insert_one(new_user)
        user = new_user
        user["_id"] = res.inserted_id
    else:
        # Ensure auth_provider set
        if user.get("auth_provider") != "google":
            users.update_one({"_id": user["_id"]}, {"$set": {"auth_provider": "google"}})

    # Issue JWT (identity is string id, role in claims)
    identity_str = str(user["_id"])
    token = create_access_token(identity=identity_str, additional_claims={"role": user.get("role", "user")})

    # Redirect back to frontend with token (dev only).
    # Frontend should read token and store it (or you can change to HttpOnly cookie approach).
    redirect_params = urlencode({"token": token, "role": user.get("role", "user")})
    redirect_to = f"{frontend_url}/oauth_callback?{redirect_params}"
    return redirect(redirect_to, code=302)
