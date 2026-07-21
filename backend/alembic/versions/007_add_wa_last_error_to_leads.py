"""add wa_last_error to leads

Revision ID: 007
Revises: 006
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("leads", sa.Column("wa_last_error", sa.String(), nullable=True))


def downgrade():
    op.drop_column("leads", "wa_last_error")
