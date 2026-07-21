"""promo campaigns + promo call purpose

Revision ID: 008
Revises: 007
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    # Add 'promo' to the existing callpurpose enum.
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so use autocommit.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE callpurpose ADD VALUE IF NOT EXISTS 'promo'")

    campaign_audience = sa.Enum(
        "all_customers", "members_by_tier", "expiring_members", "leads",
        name="campaignaudience",
    )
    campaign_status = sa.Enum(
        "running", "completed", "failed",
        name="campaignstatus",
    )
    campaign_audience.create(op.get_bind(), checkfirst=True)
    campaign_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "promo_campaigns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("audience", campaign_audience, nullable=False),
        sa.Column("tier", sa.String(), nullable=True),
        sa.Column("expiring_days", sa.Integer(), nullable=True),
        sa.Column("lead_status", sa.String(), nullable=True),
        sa.Column("status", campaign_status, nullable=False, server_default="running"),
        sa.Column("total_targets", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("calls_queued", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table("promo_campaigns")
    sa.Enum(name="campaignstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="campaignaudience").drop(op.get_bind(), checkfirst=True)
    # Note: the 'promo' value is left on the callpurpose enum (Postgres can't easily drop enum values).
