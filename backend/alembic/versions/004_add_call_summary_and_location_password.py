"""add summary to call_logs and access_code to locations

Revision ID: 004
Revises: 003
Create Date: 2026-06-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("call_logs", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("locations", sa.Column("access_code", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("locations", "access_code")
    op.drop_column("call_logs", "summary")
