"""
db_setup.py — Database Setup for AI CRM (SQLite Edition)
=============================================================================
Steps performed:
  1. Set up the environment variables from .env
  2. Create all SQLAlchemy tables in the SQLite database
  3. Run backend/scripts/seed_data.py to populate tables with production-ready data

Usage:
  python db_setup.py
"""

import sys
import os
import subprocess

# ── Resolve project root ───────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)

def step(msg: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print('='*60)

def ok(msg: str) -> None:
    print(f"  ✅ {msg}")

def warn(msg: str) -> None:
    print(f"  ⚠️  {msg}")

# ══════════════════════════════════════════════════════════════════════════════
# Step 1 — Create SQLite database tables
# ══════════════════════════════════════════════════════════════════════════════
def create_tables() -> None:
    step("Step 1 — Creating SQLite database & tables")

    # Load .env into the environment manually
    env_path = os.path.join(ROOT, "backend", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
    else:
        warn("backend/.env not found. Ensure you have copied .env.example to .env")

    # Change to backend directory so sqlite:///ai_crm.db creates the database locally there
    os.chdir(os.path.join(ROOT, "backend"))

    # In SQLite, SQLAlchemy will automatically create the database file
    # when it executes metadata.create_all if it doesn't already exist.
    from backend.database.models import Base
    from backend.database.connection import engine

    Base.metadata.create_all(bind=engine)
    table_names = list(Base.metadata.tables.keys())
    ok(f"Created {len(table_names)} tables in SQLite: {', '.join(table_names)}")


# ══════════════════════════════════════════════════════════════════════════════
# Step 2 — Seed the database
# ══════════════════════════════════════════════════════════════════════════════
def seed_database() -> None:
    step("Step 2 — Seeding database with production-ready data")

    # Note: Use the absolute path or run from backend directly.
    seed_path = os.path.join(ROOT, "backend", "scripts", "seed_data.py")
    if not os.path.exists(seed_path):
        warn(f"{seed_path} not found — skipping seed step")
        return

    # Set working directory to backend/ for correct relative python paths
    backend_dir = os.path.join(ROOT, "backend")
    # Tell set_data python subprocess to use the virtualenv
    python_exec = sys.executable

    result = subprocess.run(
        [python_exec, seed_path],
        cwd=backend_dir,
    )
    if result.returncode != 0:
        print("  ❌ Seed script failed — check errors above")
        sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════
def main() -> None:
    print("\n" + "="*60)
    print("  AI CRM — Setup Script (SQLite)")
    print("="*60)
    
    create_tables()
    seed_database()

    print("\n" + "="*60)
    print("  ✅ Setup Complete!")
    print("="*60)

if __name__ == "__main__":
    main()
