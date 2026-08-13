"""durable scheduled_calls queue

Revision ID: 010
Revises: 009
Create Date: 2026-08-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    # create_type=False so op.create_table does not implicitly re-create the enums.
    kind = postgresql.ENUM("lead", "promo", name="scheduledcallkind", create_type=False)
    status = postgresql.ENUM("pending", "sent", "failed", name="scheduledcallstatus", create_type=False)
    kind.create(op.get_bind(), checkfirst=True)
    status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "scheduled_calls",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", kind, nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("ref_id", sa.String(), nullable=True),
        sa.Column("variables", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", status, nullable=False, server_default="pending"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_scheduled_calls_due", "scheduled_calls", ["status", "due_at"])


def downgrade():
    op.drop_index("ix_scheduled_calls_due", table_name="scheduled_calls")
    op.drop_table("scheduled_calls")
    sa.Enum(name="scheduledcallstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="scheduledcallkind").drop(op.get_bind(), checkfirst=True)
