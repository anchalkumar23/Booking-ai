#!/usr/bin/env python3
"""Generate a one-time password reset link for a user.

Usage:
    python scripts/generate_reset_link.py user@example.com

Requires REDIS_URL and FRONTEND_URL in .env (or environment).
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.security import create_password_reset_token
from app.models.user import User


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python scripts/generate_reset_link.py <email>")
        sys.exit(1)

    email = sys.argv[1].strip().lower()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Error: No user found with email {email}")
            sys.exit(1)
    finally:
        db.close()

    token = create_password_reset_token(email)
    base = settings.frontend_url.rstrip("/")
    link = f"{base}/reset-password?token={token}"
    print(f"\nPassword reset link for {email} (valid 24 hours):\n")
    print(link)
    print()


if __name__ == "__main__":
    main()
