import os
import unittest
from unittest.mock import patch

from app.core.config import settings
from tests.integration.conftest import (
    MISSING_TEST_DATABASE_MESSAGE,
    require_safe_test_database_url,
)


class TransformacionExcelIntegrationSafetyTests(unittest.TestCase):
    def test_missing_test_database_url_skips_without_fallback(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(unittest.SkipTest) as context:
                require_safe_test_database_url()
        self.assertEqual(str(context.exception), MISSING_TEST_DATABASE_MESSAGE)

    def test_development_database_url_is_rejected(self) -> None:
        with patch.dict(
            os.environ,
            {"TEST_DATABASE_URL": settings.database_url},
            clear=True,
        ):
            with self.assertRaisesRegex(RuntimeError, "misma base"):
                require_safe_test_database_url()

    def test_non_postgresql_test_database_is_rejected(self) -> None:
        with patch.dict(
            os.environ,
            {"TEST_DATABASE_URL": "sqlite:///unsafe_test.db"},
            clear=True,
        ):
            with self.assertRaisesRegex(RuntimeError, "PostgreSQL"):
                require_safe_test_database_url()


if __name__ == "__main__":
    unittest.main()
