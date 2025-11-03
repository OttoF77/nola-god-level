import os
import sys
from unittest.mock import patch

# Add backend package root to sys.path
CURRENT_DIR = os.path.dirname(__file__)
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.api.datarange import data_range  # noqa: E402


class FakeCursor:
    def __init__(self, row):
        self._row = row

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        pass

    def execute(self, *args, **kwargs):
        # ignore SQL, this is a smoke test
        pass

    def fetchone(self):
        return self._row


class FakeConn:
    def __init__(self, row):
        self._row = row

    def cursor(self, cursor_factory=None):
        return FakeCursor(self._row)

    def close(self):
        pass


def run_case(cube, row):
    def fake_connect(_):
        return FakeConn(row)

    with patch("psycopg2.connect", side_effect=fake_connect):
        body = data_range(cube=cube)
        print(cube, body)
        assert body["cube"] == cube
        assert body["min_date"] == row.get("min_date")
        assert body["max_date"] == row.get("max_date")


if __name__ == "__main__":
    run_case("sales", {"min_date": "2025-05-01", "max_date": "2025-10-31"})
    run_case("products", {"min_date": "2025-05-02", "max_date": "2025-10-30"})
    run_case("payments", {"min_date": "2025-05-03", "max_date": "2025-10-29"})
    print("OK: smoke tests for /api/data-range passed with mocked DB")
