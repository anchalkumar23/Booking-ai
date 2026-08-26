"""whatsapp campaign channel + scheduled_messages queue

Revision ID: 011
Revises: 010
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade():
    # --- campaign channel + WhatsApp fields ---
    campaign_channel = postgresql.ENUM("call", "whatsapp", name="campaignchannel", create_type=False)
    campaign_channel.create(op.get_bind(), checkfirst=True)

    op.add_column("promo_campaigns", sa.Column("channel", campaign_channel, nullable=False, server_default="call"))
    op.add_column("promo_campaigns", sa.Column("wa_template", sa.String(), nullable=True))
    op.add_column("promo_campaigns", sa.Column("wa_language", sa.String(), nullable=True))
    op.add_column("promo_campaigns", sa.Column("wa_params", postgresql.JSONB(), nullable=True))
    op.add_column("promo_campaigns", sa.Column("messages_queued", sa.Integer(), nullable=False, server_default="0"))

    # --- scheduled_messages queue ---
    msg_status = postgresql.ENUM("pending", "sent", "failed", name="scheduledmessagestatus", create_type=False)
    msg_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "scheduled_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("campaign_id", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("template", sa.String(), nullable=False),
        sa.Column("language", sa.String(), nullable=False, server_default="en"),
        sa.Column("params", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", msg_status, nullable=False, server_default="pending"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_scheduled_messages_due", "scheduled_messages", ["status", "due_at"])


def downgrade():
    op.drop_index("ix_scheduled_messages_due", table_name="scheduled_messages")
    op.drop_table("scheduled_messages")
    sa.Enum(name="scheduledmessagestatus").drop(op.get_bind(), checkfirst=True)
    op.drop_column("promo_campaigns", "messages_queued")
    op.drop_column("promo_campaigns", "wa_params")
    op.drop_column("promo_campaigns", "wa_language")
    op.drop_column("promo_campaigns", "wa_template")
    op.drop_column("promo_campaigns", "channel")
    sa.Enum(name="campaignchannel").drop(op.get_bind(), checkfirst=True)
