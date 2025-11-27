# backend/app/__init__.py
import os
from flask import Flask
from flask_jwt_extended import JWTManager
from pymongo import MongoClient
from pathlib import Path
from dotenv import load_dotenv
from flask_cors import CORS   # <- add this import
from .predict import bp as predict_bp

# Load .env if exists
load_dotenv()

jwt = JWTManager()

def create_app():
    app = Flask(__name__)

    # Load config from environment
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET", "change_me")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/loansdb")

    # Enable CORS for API routes (dev). Adjust 'origins' to your frontend in production.
    # This allows the Authorization header and credentials.
    CORS(app,
    resources={r"/api/*": {"origins": "*"}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Authorization"]
)

    # Init JWT
    jwt.init_app(app)

    # Connect to MongoDB
    client = MongoClient(MONGO_URI)

    default_db = client.get_default_database()
    if default_db is not None:
        app.mongo = default_db
    else:
        app.mongo = client["loansdb"]

    # Ensure indexes exist
    try:
        app.mongo.users.create_index("email", unique=True)
        app.mongo.loan_applications.create_index("user_id")
    except Exception as e:
        print("Index warning:", e)

    # Load ML Model
    from .ml import load_model
    try:
        load_model()
    except Exception as e:
        print("ML load warning:", e)

    # Register blueprints
    from .auth import auth_bp
    from .loan import loan_bp
    from .admin import admin_bp
    from .predict import bp as predict_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(loan_bp, url_prefix="/api/loan")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(predict_bp)

    return app
