import argparse
import secrets
import sys

from sqlalchemy import select

from app.auth import hash_password
from app.db import SessionLocal
from app.models import User


def main() -> int:
    parser = argparse.ArgumentParser(description="Buat user HelmetWatch (admin/operator)")
    parser.add_argument("--email", required=True)
    parser.add_argument("--role", default="operator", choices=["admin", "operator"])
    parser.add_argument("--password", default=None)
    args = parser.parse_args()

    password = args.password or secrets.token_urlsafe(12)
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == args.email))
        if user is None:
            user = User(email=args.email, password_hash=hash_password(password), role=args.role)
            db.add(user)
            db.commit()
            action = "dibuat"
        else:
            user.password_hash = hash_password(password)
            user.role = args.role
            db.commit()
            action = "diperbarui"
    print(f"User {args.email} {action} dengan role {args.role}")
    print(f"Password: {password}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
