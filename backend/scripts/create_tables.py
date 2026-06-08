from pathlib import Path
import sys

from sqlalchemy import inspect


backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.database.base import Base
from app.database.session import engine
import app.models  # noqa: F401 - register model metadata before create_all


def main() -> None:
    registered_tables = sorted(Base.metadata.tables.keys())
    print("Registered metadata tables:")
    for table_name in registered_tables:
        print(f"- {table_name}")

    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    existing_tables = sorted(inspector.get_table_names())
    print("Existing PostgreSQL tables:")
    for table_name in existing_tables:
        print(f"- {table_name}")


if __name__ == "__main__":
    main()
