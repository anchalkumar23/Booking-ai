"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-06

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.Enum("gym", "salon", "restaurant", name="locationtype"), nullable=False),
        sa.Column("city", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("timezone", sa.String(), nullable=False, server_default="Asia/Kolkata"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "suppression_list",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("reason", sa.Enum("opt_out", "not_interested", "dnd", "manual", name="suppressionreason"), nullable=False),
        sa.Column("source", sa.Enum("call", "whatsapp", "dashboard", name="suppressionsource"), nullable=False),
        sa.Column("suppressed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phone"),
    )
    op.create_index("ix_suppression_list_phone", "suppression_list", ["phone"])

    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("language", sa.Enum("en", "hi", "ta", name="language"), nullable=False, server_default="en"),
        sa.Column("is_dnd", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_suppressed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("phone"),
    )
    op.create_index("ix_customers_phone", "customers", ["phone"])

    op.create_table(
        "appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service", sa.String(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_mins", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("status", sa.Enum("scheduled", "completed", "cancelled", "no_show", name="appointmentstatus"), nullable=False, server_default="scheduled"),
        sa.Column("gcal_event_id", sa.String(), nullable=True),
        sa.Column("booked_via", sa.Enum("call", "whatsapp", "dashboard", name="bookedvia"), nullable=False),
        sa.Column("reminder_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("location_id", "scheduled_at", name="uq_location_slot"),
    )

    op.create_table(
        "memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tier", sa.String(), nullable=False),
        sa.Column("starts_at", sa.Date(), nullable=False),
        sa.Column("expires_at", sa.Date(), nullable=False),
        sa.Column("payment_status", sa.Enum("paid", "pending", "overdue", name="paymentstatus"), nullable=False, server_default="pending"),
        sa.Column("renewal_call_sent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_memberships_expires_at", "memberships", ["expires_at"])

    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("language", sa.Enum("en", "hi", "ta", name="language"), nullable=False, server_default="en"),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("status", sa.Enum("new", "contacted", "interested", "converted", "not_interested", name="leadstatus"), nullable=False, server_default="new"),
        sa.Column("wa_sequence_step", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wa_stopped", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("call_stopped", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_leads_phone", "leads", ["phone"])

    op.create_table(
        "call_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("bolna_call_id", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("direction", sa.Enum("inbound", "outbound", name="calldirection"), nullable=False),
        sa.Column("purpose", sa.Enum("booking", "reminder", "renewal", "lead", "inbound", name="callpurpose"), nullable=False),
        sa.Column("outcome", sa.Enum("booked", "rescheduled", "busy", "not_interested", "no_answer", "transferred", "low_confidence", "failed", name="calloutcome"), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("duration_secs", sa.Integer(), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("recording_url", sa.String(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("called_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("bolna_call_id"),
    )
    op.create_index("ix_call_logs_bolna_call_id", "call_logs", ["bolna_call_id"])
    op.create_index("ix_call_logs_phone", "call_logs", ["phone"])

    op.create_table(
        "whatsapp_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("wa_message_id", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("direction", sa.Enum("inbound", "outbound", name="wadirection"), nullable=False),
        sa.Column("message_type", sa.Enum("template", "session", name="wamessagetype"), nullable=False),
        sa.Column("template_name", sa.String(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.Enum("sent", "delivered", "read", "failed", "replied", name="wastatus"), nullable=False, server_default="sent"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("wa_message_id"),
    )
    op.create_index("ix_whatsapp_messages_wa_message_id", "whatsapp_messages", ["wa_message_id"])
    op.create_index("ix_whatsapp_messages_phone", "whatsapp_messages", ["phone"])

    op.create_table(
        "lead_sequence_steps",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("channel", sa.Enum("whatsapp", "call", name="stepchannel"), nullable=False),
        sa.Column("status", sa.Enum("pending", "sent", "delivered", "replied", "failed", name="stepstatus"), nullable=False, server_default="pending"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("lead_sequence_steps")
    op.drop_table("whatsapp_messages")
    op.drop_table("call_logs")
    op.drop_table("leads")
    op.drop_table("memberships")
    op.drop_table("appointments")
    op.drop_table("customers")
    op.drop_table("suppression_list")
    op.drop_table("locations")
    op.drop_table("users")
