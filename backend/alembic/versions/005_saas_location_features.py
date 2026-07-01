"""SaaS: location password, knowledge base, WhatsApp credentials, owner

Revision ID: 005
Revises: 004
Create Date: 2026-06-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("locations", sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("locations", sa.Column("password_hash", sa.String(), nullable=True))
    op.add_column("locations", sa.Column("knowledge_base", sa.Text(), nullable=True))
    op.add_column("locations", sa.Column("whatsapp_phone_number_id", sa.String(), nullable=True))
    op.add_column("locations", sa.Column("whatsapp_waba_id", sa.String(), nullable=True))
    op.add_column("locations", sa.Column("whatsapp_access_token", sa.String(), nullable=True))
    op.add_column("locations", sa.Column("whatsapp_display_phone", sa.String(), nullable=True))
    op.drop_column("locations", "access_code")


def downgrade() -> None:
    op.add_column("locations", sa.Column("access_code", sa.String(), nullable=True))
    op.drop_column("locations", "whatsapp_display_phone")
    op.drop_column("locations", "whatsapp_access_token")
    op.drop_column("locations", "whatsapp_waba_id")
    op.drop_column("locations", "whatsapp_phone_number_id")
    op.drop_column("locations", "knowledge_base")
    op.drop_column("locations", "password_hash")
    op.drop_column("locations", "owner_id")
