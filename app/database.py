from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.engine import URL


DATABASE_URL = URL.create(
    drivername="postgresql+psycopg",
    username="postgres",
    password="Postgres123!",
    host="localhost",
    port=5432,
    database="saas_agenda"
)

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
