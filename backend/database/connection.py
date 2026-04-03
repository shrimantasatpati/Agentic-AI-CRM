"""Database Connection Management"""

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, StaticPool
import os
from pathlib import Path

# 1. Get the absolute path to the backend directory (two folders up from connection.py)
# Assuming: backend/database/connection.py
BASE_DIR = Path(__file__).resolve().parent.parent

# 2. Define the absolute path to the database file
DEFAULT_BACKEND_DB_PATH = BASE_DIR / 'ai_crm.db'

# 3. Fetch from .env
env_db_url = os.getenv("DATABASE_URL")

# 4. Bulletproof path resolution
if env_db_url:
    DATABASE_URL = env_db_url
else:
    # SQLAlchemy requires a specific prefix for absolute SQLite paths based on the OS
    # Windows needs 3 slashes (sqlite:///C:/...) and Unix needs 4 (sqlite:////usr/...)
    if os.name == 'nt':  # Windows
        DATABASE_URL = f"sqlite:///{DEFAULT_BACKEND_DB_PATH}"
    else:  # Linux/Mac
        DATABASE_URL = f"sqlite:////{DEFAULT_BACKEND_DB_PATH}"

# Create engine with appropriate pool settings
if "sqlite" in DATABASE_URL.lower():
    # SQLite doesn't support NullPool
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False  # Set to True for SQL logging
    )
else:
    # PostgreSQL
    engine = create_engine(
        DATABASE_URL,
        poolclass=NullPool,
        echo=False  # Set to True for SQL logging
    )

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    Dependency to get database session
    Usage: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db_tables(base):
    """
    Initialize database tables - only creates if they don't exist
    """
    try:
        # Check if any tables already exist
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        if not existing_tables:
            # No tables exist yet, create them all
            base.metadata.create_all(bind=engine)
            print("✓ Database tables created successfully")
        else:
            print(f"✓ Database already exists with {len(existing_tables)} tables")
    except Exception as e:
        print(f"Database initialization error: {e}")
        # Fallback: try to create all anyway
        try:
            base.metadata.create_all(bind=engine)
        except Exception as error:
            print(f"Failed to create tables: {error}")
