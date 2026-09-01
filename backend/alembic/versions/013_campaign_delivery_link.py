"""link whatsapp_messages + call_logs to their campaign for delivery stats

Revision ID: 013
Revises: 012
Create Date: 2026-09-02
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("whatsapp_messages", sa.Column("campaign_id", sa.String(), nullable=True))
    op.create_index("ix_whatsapp_messages_campaign", "whatsapp_messages", ["campaign_id"])
    op.add_column("call_logs", sa.Column("campaign_id", sa.String(), nullable=True))
    op.create_index("ix_call_logs_campaign", "call_logs", ["campaign_id"])


def downgrade():
    op.drop_index("ix_call_logs_campaign", table_name="call_logs")
    op.drop_column("call_logs", "campaign_id")
    op.drop_index("ix_whatsapp_messages_campaign", table_name="whatsapp_messages")
    op.drop_column("whatsapp_messages", "campaign_id")
