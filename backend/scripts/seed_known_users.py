import sys
from pathlib import Path
backend_dir = Path(r"c:\Users\shrushti\Customer-Support-Assistant-New\backend")
sys.path.insert(0, str(backend_dir))

from app.models.database import SessionLocal, Base, engine
from app.models.user import User
from app.utils.security import hash_password

db = SessionLocal()

test_users = [
    ("System Admin", "admin@company.com", "Admin1234!", "admin"),
    ("Support Employee", "employee@company.com", "Employee1234!", "employee"),
    ("Customer User", "customer@company.com", "Customer1234!", "customer"),
]

for name, email, password, role in test_users:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        existing.password_hash = hash_password(password)
        existing.role = role
        existing.name = name
        existing.is_active = True
        print(f"Updated user {email} (role: {role})")
    else:
        u = User(
            name=name,
            email=email,
            password_hash=hash_password(password),
            role=role,
            is_active=True
        )
        db.add(u)
        print(f"Created user {email} (role: {role})")

db.commit()
all_users = db.query(User).all()
print("\nAll DB Users:")
for u in all_users:
    print(f"  ID {u.id}: {u.name} ({u.email}) - {u.role} [active={u.is_active}]")

db.close()
