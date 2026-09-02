"""add ai_enabled toggle to conversation_states

Revision ID: 015
Revises: 014
Create Date: 2026-09-02
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "conversation_states",
        sa.Column("ai_enabled", sa.Boolean(), server_default="true", nullable=False),
    )


def downgrade():
    op.drop_column("conversation_states", "ai_enabled")
