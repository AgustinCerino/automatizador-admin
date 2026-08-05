from __future__ import annotations

import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import warnings
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.database.base import Base


MISSING_TEST_DATABASE_MESSAGE = (
    "Integración omitida: configure TEST_DATABASE_URL con una base PostgreSQL "
    "exclusiva de testing."
)


def require_safe_test_database_url() -> str:
    test_database_url = os.getenv("TEST_DATABASE_URL")
    if not test_database_url:
        raise unittest.SkipTest(MISSING_TEST_DATABASE_MESSAGE)
    parsed = make_url(test_database_url)
    development = make_url(settings.database_url)
    same_database_target = (
        parsed.host == development.host
        and parsed.port == development.port
        and parsed.database == development.database
        and parsed.username == development.username
    )
    if test_database_url == settings.database_url or same_database_target:
        raise RuntimeError(
            "TEST_DATABASE_URL no puede apuntar a la misma base que DATABASE_URL.",
        )
    if not parsed.drivername.startswith("postgresql"):
        raise RuntimeError("TEST_DATABASE_URL debe apuntar a PostgreSQL.")
    database_name = parsed.database or ""
    if not database_name.casefold().endswith("_test"):
        warnings.warn(
            "Se recomienda que la base indicada por TEST_DATABASE_URL termine "
            "en _test.",
            RuntimeWarning,
            stacklevel=2,
        )
    return test_database_url


def create_test_engine() -> Engine:
    engine = create_engine(require_safe_test_database_url(), pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    return engine


class IsolatedDatabaseAndStorage:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine
        self.connection = None
        self.transaction = None
        self.session_factory = None
        self.storage_directory: TemporaryDirectory[str] | None = None
        self.storage_root: Path | None = None
        self.patchers: list[patch] = []

    def start(self) -> None:
        self.connection = self.engine.connect()
        self.transaction = self.connection.begin()
        self.session_factory = sessionmaker(
            bind=self.connection,
            class_=Session,
            autoflush=False,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        self.storage_directory = TemporaryDirectory()
        self.storage_root = Path(self.storage_directory.name) / "storage"
        self.storage_root.mkdir(parents=True)
        processed_root = self.storage_root / "processed"
        targets = {
            "app.services.file_service.STORAGE_ROOT": self.storage_root,
            (
                "app.services.transformacion_excel_inspeccion_service."
                "STORAGE_ROOT"
            ): self.storage_root,
            (
                "app.services.transformacion_excel_generation_service."
                "STORAGE_ROOT"
            ): self.storage_root,
            (
                "app.services.transformacion_excel_generation_service."
                "PROCESSED_STORAGE_ROOT"
            ): processed_root,
            (
                "app.services.transformacion_excel_operational_service."
                "STORAGE_ROOT"
            ): self.storage_root,
        }
        self.patchers = [patch(target, value) for target, value in targets.items()]
        for patcher in self.patchers:
            patcher.start()

    def session(self) -> Session:
        if self.session_factory is None:
            raise RuntimeError("El entorno aislado no fue iniciado.")
        return self.session_factory()

    def stop(self) -> None:
        for patcher in reversed(self.patchers):
            patcher.stop()
        if self.transaction is not None:
            self.transaction.rollback()
        if self.connection is not None:
            self.connection.close()
        if self.storage_directory is not None:
            self.storage_directory.cleanup()
