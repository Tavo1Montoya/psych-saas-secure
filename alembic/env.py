from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
import os
from dotenv import load_dotenv

import sys
from pathlib import Path

# =========================
# ✅ Asegurar importación de "app"
# =========================
BASE_DIR = Path(__file__).resolve().parents[1]  # sube de alembic/ -> raíz del proyecto
sys.path.insert(0, str(BASE_DIR))

# =========================
# ✅ Cargar variables .env
# =========================
load_dotenv()

config = context.config

# =========================
# ✅ FORZAR que Alembic use DATABASE_URL del .env
#    (evita que alembic.ini tenga contraseñas)
# =========================
database_url = os.getenv("DATABASE_URL")

if not database_url:
    raise ValueError(
        "❌ DATABASE_URL no está definida. Revisa tu archivo .env o variables de entorno."
    )

# Esto sobreescribe sqlalchemy.url en tiempo de ejecución
config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# =========================
# ✅ Base REAL
# =========================
from app.db.base_class import Base  # noqa: E402

# =========================
# ✅ IMPORTAR TODOS LOS MODELOS (OBLIGATORIO)
# =========================
from app.models.user import User  # noqa: F401, E402
from app.models.patient import Patient  # noqa: F401, E402
from app.models.appointment import Appointment  # noqa: F401, E402
from app.models.note import Note  # noqa: F401, E402
from app.models.clinic_settings import ClinicSettings  # noqa: F401, E402
from app.models.appointment_block import AppointmentBlock  # noqa: F401, E402

# ✅ LA LINEA CLAVE
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    # ✅ Ya viene del .env por el set_main_option de arriba
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # ✅ engine_from_config usará sqlalchemy.url que ya seteamos arriba
    connectable = engine_from_config(
        config.get_section(config.config_ini_section) or {},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()