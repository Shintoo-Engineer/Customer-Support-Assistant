import os
import sys
from pathlib import Path

from dotenv import load_dotenv


# Add backend root to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Load environment variables from .env
load_dotenv()

from app.models.database import Base, SessionLocal, engine
from app.models.user import User
from app.utils.security import hash_password


# =========================
# Seed User Configuration
# =========================

USERS = [
    {
        "name": "System Admin",
        "email": "admin@company.com",
        "password_env": "SEED_ADMIN_PASSWORD",
        "role": "admin",
    },
    {
        "name": "Support Employee",
        "email": "employee@company.com",
        "password_env": "SEED_EMPLOYEE_PASSWORD",
        "role": "employee",
    },
    {
        "name": "Customer User",
        "email": "customer@company.com",
        "password_env": "SEED_CUSTOMER_PASSWORD",
        "role": "customer",
    },
]


# =========================
# Seed Users
# =========================

def seed_users():
    # Ensure all registered SQLAlchemy tables exist.
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        for user_data in USERS:
            password = os.getenv(user_data["password_env"])

            if not password:
                raise RuntimeError(
                    f"Required environment variable "
                    f"{user_data['password_env']} is not configured."
                )

            existing_user = (
                db.query(User)
                .filter(User.email == user_data["email"])
                .first()
            )

            if existing_user:
                print(
                    f"User already exists: "
                    f"{user_data['email']} "
                    f"({existing_user.role})"
                )
                continue

            user = User(
                name=user_data["name"],
                email=user_data["email"],
                password_hash=hash_password(password),
                role=user_data["role"],
                is_active=True,
            )

            db.add(user)

            print(
                f"Created user: "
                f"{user_data['email']} "
                f"({user_data['role']})"
            )

        db.commit()

        print("User seeding completed successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_users()