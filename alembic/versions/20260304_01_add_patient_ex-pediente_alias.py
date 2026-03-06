"""add expediente_number and alias to patients

Revision ID: 20260304_01
Revises: e138e248b9f3
Create Date: 2026-03-04
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260304_01"
down_revision = "e138e248b9f3"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS expediente_number VARCHAR
    """)

    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS alias VARCHAR
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_patients_expediente_number
        ON patients (expediente_number)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_patients_alias
        ON patients (alias)
    """)


def downgrade():
    op.execute("""
        DROP INDEX IF EXISTS ix_patients_alias
    """)

    op.execute("""
        DROP INDEX IF EXISTS ix_patients_expediente_number
    """)

    op.execute("""
        ALTER TABLE patients
        DROP COLUMN IF EXISTS alias
    """)

    op.execute("""
        ALTER TABLE patients
        DROP COLUMN IF EXISTS expediente_number
    """)