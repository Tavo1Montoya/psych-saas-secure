"""make note appointment optional

Revision ID: 20260305_note_optional
Revises: 20260304_01
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260305_note_optional"
down_revision = "20260304_01"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "notes",
        "appointment_id",
        existing_type=sa.Integer(),
        nullable=True
    )


def downgrade():
    op.alter_column(
        "notes",
        "appointment_id",
        existing_type=sa.Integer(),
        nullable=False
    )