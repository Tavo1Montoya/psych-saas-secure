from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e138e248b9f3"
down_revision = "29a8bf5dbc71"
branch_labels = None
depends_on = None


def upgrade():
    # Seguro aunque ya exista la columna
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS owner_user_id INTEGER
    """)


def downgrade():
    op.execute("""
        ALTER TABLE users
        DROP COLUMN IF EXISTS owner_user_id
    """)