"""add missing created_at to conversation_states (UUIDMixin requires it)

Revision ID: 014
Revises: 013
Create Date: 2026-09-02
"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "conversation_states",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_column("conversation_states", "created_at")
