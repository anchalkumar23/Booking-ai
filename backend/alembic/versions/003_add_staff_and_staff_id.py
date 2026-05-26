"""add staff table and staff_id to appointments

Revision ID: 003
Revises: 002
Create Date: 2026-05-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_location_slot", "appointments", type_="unique")

    op.create_table(
        "staff",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("working_hours", postgresql.JSONB(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_staff_location_id", "staff", ["location_id"])

    op.add_column(
        "appointments",
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_appointments_staff_id",
        "appointments", "staff",
        ["staff_id"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_appointments_staff_id", "appointments", type_="foreignkey")
    op.drop_column("appointments", "staff_id")
    op.drop_table("staff")
    op.create_unique_constraint(
        "uq_location_slot", "appointments", ["location_id", "scheduled_at"]
    )
