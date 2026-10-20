from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return current datetime in UTC."""
    return datetime.now(UTC).replace(tzinfo=None)
