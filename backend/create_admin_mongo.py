from app import create_app
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    admin_email = "karthikjonnalagadda01@gmail.com"
    admin_password = "karthik01"
    admin_name = "Administrator"

    hashed = generate_password_hash(admin_password)

    users = app.mongo.users

    existing = users.find_one({"email": admin_email})
    if existing:
        print("Admin already exists. Updating password and role...")
        users.update_one(
            {"email": admin_email},
            {"$set": {
                "password_hash": hashed,
                "role": "admin",
                "name": admin_name
            }}
        )
    else:
        print("Creating new admin user...")
        users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": admin_name,
            "role": "admin",
            "auth_provider": "email"
        })

    print("Admin created/updated:", admin_email)
