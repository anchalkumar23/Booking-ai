"""inbox: conversation status + canned replies

Revision ID: 012
Revises: 011
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade():
    conv_status = postgresql.ENUM("open", "resolved", name="convstatus", create_type=False)
    conv_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "conversation_states",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("status", conv_status, nullable=False, server_default="open"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_conversation_states_phone", "conversation_states", ["phone"], unique=True)

    op.create_table(
        "canned_replies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table("canned_replies")
    op.drop_index("ix_conversation_states_phone", table_name="conversation_states")
    op.drop_table("conversation_states")
    sa.Enum(name="convstatus").drop(op.get_bind(), checkfirst=True)
