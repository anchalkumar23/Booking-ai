"""add uploaded_list value to campaignaudience enum

Revision ID: 009
Revises: 008
Create Date: 2026-08-02
"""
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so use autocommit.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE campaignaudience ADD VALUE IF NOT EXISTS 'uploaded_list'")


def downgrade():
    # Postgres can't easily drop a single enum value; leave it in place.
    pass
