"""add follow_up_date to leads

Revision ID: 006
Revises: 005
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("leads", sa.Column("follow_up_date", sa.Date(), nullable=True))


def downgrade():
    op.drop_column("leads", "follow_up_date")
