"""seed admin user

Revision ID: 002
Revises: 001
Create Date: 2026-05-06

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text
import uuid
import os
from passlib.context import CryptContext
from dotenv import load_dotenv
load_dotenv()

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
    if result == 0:
        admin_email = os.environ["ADMIN_EMAIL"]
        admin_password = os.environ["ADMIN_PASSWORD"]
        admin_name = os.environ.get("ADMIN_NAME", "Admin")
        conn.execute(
            text(
                "INSERT INTO users (id, email, hashed_password, full_name, is_active, created_at) "
                "VALUES (:id, :email, :password, :name, true, NOW())"
            ),
            {
                "id": str(uuid.uuid4()),
                "email": admin_email,
                "password": pwd_context.hash(admin_password),
                "name": admin_name,
            },
        )


def downgrade() -> None:
    pass
