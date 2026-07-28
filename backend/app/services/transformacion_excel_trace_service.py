from copy import deepcopy
from datetime import date, datetime, timezone
from decimal import Decimal
import json
import math
from pathlib import PurePath
import re
from typing import Any
from uuid import uuid4


MAX_TRACE_EVENTS = 200
MAX_METADATA_ITEMS = 20
MAX_METADATA_DEPTH = 3
MAX_METADATA_STRING_LENGTH = 500
TRACE_LEVELS = {"INFO", "WARNING", "ERROR"}
TRACE_EVENT_TYPES = {
    "CONFIGURATION_SAVED",
    "TEMPLATE_APPLIED",
    "VALIDATION_SUCCEEDED",
    "VALIDATION_FAILED",
    "GENERATION_STARTED",
    "GENERATION_COMPLETED",
    "GENERATION_REUSED",
    "TECHNICAL_ERROR",
    "TEMPLATE_CREATED_FROM_EXECUTION",
}

SENSITIVE_METADATA_KEYS = {
    "ruta_storage",
    "ruta_absoluta",
    "absolute_path",
    "path",
    "token",
    "access_token",
    "refresh_token",
    "password",
    "contrasena",
    "contraseña",
    "stack_trace",
    "stacktrace",
    "traceback",
    "configuracion",
    "configuracion_completa",
    "configuration",
    "configuration_data",
    "configuration_snapshot",
    "full_configuration",
    "config",
    "file_content",
    "contenido_archivo",
    "content",
    "dataframe",
}
WINDOWS_ABSOLUTE_PATH = re.compile(r"(?:[a-zA-Z]:[\\/]|\\\\)[^\s,;]*")
POSIX_ABSOLUTE_PATH = re.compile(r"(?<![:\w])/(?:[^\s,;]+)")


def _normalize_occurred_at(value: datetime | None) -> datetime:
    occurred_at = value or datetime.now(timezone.utc)
    if not isinstance(occurred_at, datetime):
        raise ValueError("occurred_at debe ser datetime")
    if occurred_at.tzinfo is None or occurred_at.utcoffset() is None:
        occurred_at = occurred_at.replace(tzinfo=timezone.utc)
    return occurred_at


def _is_absolute_path(value: str) -> bool:
    stripped = value.strip()
    return bool(
        WINDOWS_ABSOLUTE_PATH.search(stripped)
        or POSIX_ABSOLUTE_PATH.search(stripped)
    )


def _is_sensitive_metadata_key(key: str) -> bool:
    normalized = key.strip().casefold()
    if normalized in SENSITIVE_METADATA_KEYS:
        return True
    fragments = (
        "ruta_storage",
        "ruta_absoluta",
        "absolute_path",
        "token",
        "password",
        "contrasena",
        "contraseña",
        "stack",
        "traceback",
        "dataframe",
        "contenido_archivo",
        "file_content",
    )
    return any(fragment in normalized for fragment in fragments)


def _sanitize_metadata_value(value: Any, depth: int) -> Any:
    if depth > MAX_METADATA_DEPTH:
        raise ValueError("metadata excede la profundidad permitida")
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        return value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        if isinstance(value, datetime) and (
            value.tzinfo is None or value.utcoffset() is None
        ):
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, str):
        if _is_absolute_path(value):
            return "[REDACTED_PATH]"
        return value[:MAX_METADATA_STRING_LENGTH]
    if isinstance(value, PurePath):
        raise ValueError("metadata no puede contener rutas")
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for key, item in list(value.items())[:MAX_METADATA_ITEMS]:
            normalized_key = str(key).strip()
            if _is_sensitive_metadata_key(normalized_key):
                continue
            sanitized[normalized_key] = _sanitize_metadata_value(
                item,
                depth + 1,
            )
        return sanitized
    if isinstance(value, (list, tuple)):
        return [
            _sanitize_metadata_value(item, depth + 1)
            for item in list(value)[:MAX_METADATA_ITEMS]
        ]
    raise ValueError(
        f"Tipo no permitido en metadata: {type(value).__name__}",
    )


def sanitize_trace_metadata(metadata: object | None) -> dict[str, Any]:
    if metadata is None:
        return {}
    if not isinstance(metadata, dict):
        raise ValueError("metadata debe ser un diccionario")
    sanitized = _sanitize_metadata_value(metadata, 0)
    json.dumps(sanitized, allow_nan=False)
    return sanitized


def _is_duplicate_generation_reused(
    events: list[object],
    event_type: str,
    metadata: dict[str, Any],
) -> bool:
    if event_type != "GENERATION_REUSED" or not events:
        return False
    last_event = events[-1]
    if not isinstance(last_event, dict):
        return False
    last_metadata = last_event.get("metadata")
    if not isinstance(last_metadata, dict):
        return False
    return (
        last_event.get("event_type") == event_type
        and last_metadata.get("archivo_id") == metadata.get("archivo_id")
        and last_metadata.get("checksum") == metadata.get("checksum")
    )


def append_transformacion_trace_event(
    resumen_json: object | None,
    event_type: str,
    level: str,
    message: str,
    actor_user_id: int | None = None,
    from_state: str | None = None,
    to_state: str | None = None,
    metadata: object | None = None,
    occurred_at: datetime | None = None,
) -> dict[str, Any]:
    if event_type not in TRACE_EVENT_TYPES:
        raise ValueError("event_type no permitido")
    if level not in TRACE_LEVELS:
        raise ValueError("level no permitido")
    normalized_message = message.strip()
    if not normalized_message:
        raise ValueError("message no puede estar vacío")

    result = deepcopy(resumen_json) if isinstance(resumen_json, dict) else {}
    transformacion = result.get("transformacion_excel")
    if not isinstance(transformacion, dict):
        transformacion = {}
    else:
        transformacion = deepcopy(transformacion)
    events = transformacion.get("trazabilidad")
    if not isinstance(events, list):
        events = []
    else:
        events = deepcopy(events)

    sanitized_metadata = sanitize_trace_metadata(metadata)
    if _is_duplicate_generation_reused(
        events,
        event_type,
        sanitized_metadata,
    ):
        transformacion["trazabilidad"] = events[-MAX_TRACE_EVENTS:]
        result["transformacion_excel"] = transformacion
        return result

    event = {
        "event_id": str(uuid4()),
        "event_type": event_type,
        "level": level,
        "occurred_at": _normalize_occurred_at(occurred_at).isoformat(),
        "actor_user_id": actor_user_id,
        "from_state": from_state,
        "to_state": to_state,
        "message": normalized_message[:MAX_METADATA_STRING_LENGTH],
        "metadata": sanitized_metadata,
    }
    events.append(event)
    transformacion["trazabilidad"] = events[-MAX_TRACE_EVENTS:]
    result["transformacion_excel"] = transformacion
    return result


def get_transformacion_trace_events(
    resumen_json: object | None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    if type(limit) is not int or not 1 <= limit <= MAX_TRACE_EVENTS:
        raise ValueError("limit debe estar entre 1 y 200")
    if not isinstance(resumen_json, dict):
        return []
    transformacion = resumen_json.get("transformacion_excel")
    if not isinstance(transformacion, dict):
        return []
    events = transformacion.get("trazabilidad")
    if not isinstance(events, list):
        return []
    readable_events: list[dict[str, Any]] = []
    for raw_event in events:
        if not isinstance(raw_event, dict):
            continue
        event = deepcopy(raw_event)
        try:
            event["metadata"] = sanitize_trace_metadata(
                event.get("metadata"),
            )
        except ValueError:
            event["metadata"] = {}
        readable_events.append(event)

    def event_timestamp(event: dict[str, Any]) -> datetime:
        raw_timestamp = event.get("occurred_at")
        if isinstance(raw_timestamp, datetime):
            parsed = raw_timestamp
        elif isinstance(raw_timestamp, str):
            try:
                parsed = datetime.fromisoformat(
                    raw_timestamp.replace("Z", "+00:00"),
                )
            except ValueError:
                return datetime.min.replace(tzinfo=timezone.utc)
        else:
            return datetime.min.replace(tzinfo=timezone.utc)
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed

    readable_events.sort(key=event_timestamp, reverse=True)
    return readable_events[:limit]
