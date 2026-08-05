from copy import deepcopy
from datetime import datetime, timedelta, timezone
import re
from typing import Any, Iterable

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Archivo, EjecucionProceso, Usuario
from app.core.config import settings
from app.schemas.transformacion_excel import TransformacionExcelConfig
from app.schemas.transformacion_excel_operacion import (
    TransformacionExcelOperationalIssueRead,
    TransformacionExcelOperationalSummaryRead,
)
from app.services.file_service import STORAGE_ROOT
from app.services.transformacion_excel_config_service import (
    get_transformacion_ejecucion_or_raise,
)
from app.services.transformacion_excel_generation_service import (
    OUTPUT_FILE_TYPE,
)
from app.services.transformacion_excel_trace_service import (
    MAX_TRACE_EVENTS,
    get_transformacion_trace_events,
)
from app.services.transformacion_excel_security_service import (
    TransformacionExcelSecurityError,
    resolve_storage_path_safely,
)


EDITABLE_STATES = {"CARGADO", "CONFIGURADO", "VALIDADO"}
TERMINAL_STATES = {"COMPLETADO", "CANCELADO", "APROBADO", "RECHAZADO"}
WINDOWS_PATH_IN_TEXT = re.compile(r"(?:[a-zA-Z]:[\\/]|\\\\)[^\s,;]+")
POSIX_PATH_IN_TEXT = re.compile(r"(?<![:\w])/(?:[^\s,;]+)")
SENSITIVE_SAMPLE_KEYS = {
    "ruta_storage",
    "path",
    "absolute_path",
    "token",
    "password",
    "stack_trace",
    "traceback",
}


def parse_operational_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _safe_int(value: object) -> int | None:
    if type(value) is int:
        return value
    return None


def _safe_non_negative_int(value: object) -> int | None:
    integer = _safe_int(value)
    if integer is None or integer < 0:
        return None
    return integer


def _safe_string(value: object) -> str | None:
    return value if isinstance(value, str) else None


def sanitize_operational_message(message: object) -> str:
    if not isinstance(message, str) or not message.strip():
        return "Error técnico en la ejecución de transformación."
    first_line = message.strip().splitlines()[0]
    if "traceback" in first_line.casefold() or "stack trace" in first_line.casefold():
        return "Error técnico en la ejecución de transformación."
    first_line = WINDOWS_PATH_IN_TEXT.sub("[RUTA]", first_line)
    first_line = POSIX_PATH_IN_TEXT.sub("[RUTA]", first_line)
    return first_line[:500]


def _sanitize_sample_value(value: object, depth: int = 0) -> object:
    if depth > 3:
        return None
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        if WINDOWS_PATH_IN_TEXT.search(value) or value.startswith("/"):
            return "[RUTA]"
        return value[:500]
    if isinstance(value, dict):
        return {
            str(key): _sanitize_sample_value(item, depth + 1)
            for key, item in list(value.items())[:20]
            if str(key).casefold() not in SENSITIVE_SAMPLE_KEYS
        }
    if isinstance(value, (list, tuple)):
        return [
            _sanitize_sample_value(item, depth + 1)
            for item in list(value)[:20]
        ]
    return str(value)[:500]


def _issue_dict(
    *,
    severity: str,
    origin: str,
    code: str,
    message: object,
    blocking: bool,
    count: object = 1,
    output_column: object = None,
    source_column: object = None,
    sample_rows: object = None,
) -> dict[str, Any]:
    normalized_count = _safe_non_negative_int(count) or 1
    samples = sample_rows if isinstance(sample_rows, list) else []
    return {
        "severity": severity,
        "origin": origin,
        "code": code,
        "message": sanitize_operational_message(message),
        "blocking": blocking,
        "count": normalized_count,
        "output_column": _safe_string(output_column),
        "source_column": _safe_string(source_column),
        "sample_rows": [
            _sanitize_sample_value(sample)
            for sample in samples[:10]
            if isinstance(sample, dict)
        ],
    }


def validation_issues_from_summary(
    validation: object,
) -> list[dict[str, Any]]:
    if not isinstance(validation, dict):
        return []
    issues: list[dict[str, Any]] = []
    for key, severity, blocking in (
        ("errors", "ERROR", True),
        ("warnings", "WARNING", False),
    ):
        raw_issues = validation.get(key)
        if not isinstance(raw_issues, list):
            continue
        for raw_issue in raw_issues:
            if not isinstance(raw_issue, dict):
                continue
            code = raw_issue.get("code")
            if not isinstance(code, str) or not code.strip():
                code = "VALIDATION_ISSUE"
            issues.append(
                _issue_dict(
                    severity=severity,
                    origin="VALIDATION",
                    code=code,
                    message=raw_issue.get("message"),
                    blocking=blocking,
                    count=raw_issue.get("count"),
                    output_column=raw_issue.get("output_column"),
                    source_column=raw_issue.get("source_column"),
                    sample_rows=raw_issue.get("sample_rows"),
                ),
            )
    return issues


def merge_operational_issues(
    issues: Iterable[dict[str, Any]],
) -> list[TransformacionExcelOperationalIssueRead]:
    grouped: dict[tuple[object, ...], dict[str, Any]] = {}
    for issue in issues:
        key = (
            issue.get("severity"),
            issue.get("origin"),
            issue.get("code"),
            issue.get("output_column"),
            issue.get("source_column"),
        )
        if key not in grouped:
            grouped[key] = deepcopy(issue)
            grouped[key]["sample_rows"] = list(
                issue.get("sample_rows") or [],
            )[:10]
            continue
        existing = grouped[key]
        existing["count"] = int(existing.get("count") or 0) + int(
            issue.get("count") or 0,
        )
        existing["blocking"] = bool(
            existing.get("blocking") or issue.get("blocking"),
        )
        existing["sample_rows"] = (
            list(existing.get("sample_rows") or [])
            + list(issue.get("sample_rows") or [])
        )[:10]
    return [
        TransformacionExcelOperationalIssueRead.model_validate(issue)
        for issue in grouped.values()
    ]


def determine_transformacion_action_required(
    estado: str,
    has_configuration: bool,
    validation_available: bool,
    validation_valid: bool | None,
    output_record_exists: bool,
    output_file_exists: bool,
    has_blocking_issues: bool,
) -> str:
    if estado in {"CANCELADO", "APROBADO", "RECHAZADO"}:
        return "NONE"
    if estado == "PROCESANDO":
        return "REVIEW_ERROR" if has_blocking_issues else "WAIT"
    if estado == "ERROR":
        return "REVIEW_ERROR"
    if not has_configuration:
        return "CONFIGURE"
    if has_blocking_issues:
        return "FIX_ERRORS"
    if estado == "CONFIGURADO":
        return "VALIDATE"
    if estado == "VALIDADO":
        return "GENERATE"
    if estado == "COMPLETADO" and output_record_exists and output_file_exists:
        return "DOWNLOAD"
    if estado == "COMPLETADO":
        return "REGENERATE"
    return "REVIEW_ERROR"


def determine_transformacion_capabilities(
    estado: str,
    has_configuration: bool,
    has_blocking_issues: bool,
    source_file_exists: bool,
    output_record_exists: bool,
    output_file_exists: bool,
) -> dict[str, bool]:
    validation_allowed = estado not in TERMINAL_STATES | {"PROCESANDO"}
    return {
        "can_edit_configuration": estado in EDITABLE_STATES,
        "can_validate": has_configuration and validation_allowed,
        "can_generate": (
            estado == "VALIDADO"
            and not has_blocking_issues
            and source_file_exists
        ),
        "can_download": (
            estado == "COMPLETADO"
            and output_record_exists
            and output_file_exists
        ),
    }


def _valid_persisted_config(
    transformacion: dict[str, Any],
) -> tuple[TransformacionExcelConfig | None, bool]:
    if "configuracion" not in transformacion:
        return None, False
    try:
        return (
            TransformacionExcelConfig.model_validate(
                transformacion.get("configuracion"),
            ),
            False,
        )
    except (ValidationError, TypeError, ValueError):
        return None, True


def _validation_read(validation: object) -> dict[str, Any]:
    if not isinstance(validation, dict):
        return {"available": False, "valid": None}
    return {
        "available": True,
        "valid": validation.get("valid")
        if isinstance(validation.get("valid"), bool)
        else None,
        "validated_at": parse_operational_datetime(
            validation.get("validated_at"),
        ),
        "total_filas_entrada": _safe_non_negative_int(
            validation.get("total_filas_entrada"),
        ),
        "filas_validas": _safe_non_negative_int(
            validation.get("filas_validas"),
        ),
        "filas_con_errores": _safe_non_negative_int(
            validation.get("filas_con_errores"),
        ),
        "filas_con_advertencias": _safe_non_negative_int(
            validation.get("filas_con_advertencias"),
        ),
        "duplicados_eliminados": _safe_non_negative_int(
            validation.get("duplicados_eliminados"),
        ),
    }


def _template_read(template: object) -> dict[str, Any] | None:
    if not isinstance(template, dict):
        return None
    plantilla_id = _safe_int(template.get("plantilla_id"))
    nombre = _safe_string(template.get("nombre"))
    schema_version = _safe_int(template.get("schema_version"))
    if plantilla_id is None or nombre is None or schema_version is None:
        return None
    return {
        "plantilla_id": plantilla_id,
        "nombre": nombre,
        "schema_version": schema_version,
        "applied_at": parse_operational_datetime(template.get("applied_at")),
    }


def _generation_read(
    generation: object,
    output_record: Archivo | None,
    output_file_exists: bool,
    *,
    available: bool,
) -> dict[str, Any]:
    summary = generation if isinstance(generation, dict) else {}
    raw_columns = summary.get("columnas_salida")
    columns = (
        [str(column) for column in raw_columns]
        if isinstance(raw_columns, list)
        else []
    )
    return {
        "available": available,
        "archivo_id": (
            output_record.id
            if output_record is not None
            else _safe_int(summary.get("archivo_id"))
        ),
        "nombre_archivo": (
            output_record.nombre_original
            if output_record is not None
            else _safe_string(summary.get("nombre_archivo"))
        ),
        "file_exists": output_file_exists,
        "total_filas": _safe_non_negative_int(summary.get("total_filas")),
        "columnas_salida": columns,
        "size_bytes": (
            output_record.size_bytes
            if output_record is not None
            else _safe_non_negative_int(summary.get("size_bytes"))
        ),
        "checksum": (
            output_record.checksum
            if output_record is not None
            else _safe_string(summary.get("checksum"))
        ),
        "generated_at": parse_operational_datetime(
            summary.get("generated_at"),
        ),
    }


def build_transformacion_operational_summary(
    ejecucion: EjecucionProceso,
    *,
    source_record: Archivo | None = None,
    source_file_exists: bool = False,
    source_path_unsafe: bool = False,
    output_record: Archivo | None = None,
    output_file_exists: bool = False,
    output_path_unsafe: bool = False,
    now: datetime | None = None,
) -> TransformacionExcelOperationalSummaryRead:
    original_summary = ejecucion.resumen_json
    resumen = deepcopy(original_summary) if isinstance(original_summary, dict) else {}
    transformacion = resumen.get("transformacion_excel")
    if not isinstance(transformacion, dict):
        transformacion = {}

    config, invalid_config = _valid_persisted_config(transformacion)
    has_configuration = config is not None
    validation_raw = transformacion.get("validacion")
    validation = _validation_read(validation_raw)
    generation_raw = transformacion.get("generacion")
    generation_available = (
        isinstance(generation_raw, dict) or output_record is not None
    )

    raw_issues = validation_issues_from_summary(validation_raw)
    all_events = get_transformacion_trace_events(
        resumen,
        limit=MAX_TRACE_EVENTS,
    )
    if ejecucion.estado == "PROCESANDO":
        processing_started_at = next(
            (
                parse_operational_datetime(event.get("occurred_at"))
                for event in all_events
                if event.get("event_type") == "GENERATION_STARTED"
            ),
            None,
        ) or parse_operational_datetime(getattr(ejecucion, "started_at", None))
        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None or current_time.utcoffset() is None:
            current_time = current_time.replace(tzinfo=timezone.utc)
        if (
            processing_started_at is not None
            and processing_started_at
            < current_time
            - timedelta(
                minutes=settings.transformacion_excel_stale_processing_minutes,
            )
        ):
            raw_issues.append(
                _issue_dict(
                    severity="ERROR",
                    origin="GENERATION",
                    code="STALE_PROCESSING_STATE",
                    message=(
                        "La generación permanece en procesamiento por encima "
                        "del umbral operativo."
                    ),
                    blocking=True,
                ),
            )
    if ejecucion.error_message:
        raw_issues.append(
            _issue_dict(
                severity="ERROR",
                origin="EXECUTION",
                code="TECHNICAL_ERROR",
                message=ejecucion.error_message,
                blocking=True,
            ),
        )
    if invalid_config:
        raw_issues.append(
            _issue_dict(
                severity="ERROR",
                origin="CONFIGURATION",
                code="PERSISTED_CONFIGURATION_INVALID",
                message="La configuración persistida no es válida.",
                blocking=True,
            ),
        )

    source: dict[str, Any] | None = None
    if config is not None:
        if source_record is None:
            raw_issues.append(
                _issue_dict(
                    severity="ERROR",
                    origin="SOURCE_FILE",
                    code="SOURCE_FILE_RECORD_MISSING",
                    message="No existe el registro del archivo fuente.",
                    blocking=True,
                ),
            )
        else:
            source = {
                "archivo_id": source_record.id,
                "nombre_original": source_record.nombre_original,
                "extension": source_record.extension,
                "file_exists": source_file_exists,
                "checksum": source_record.checksum,
                "sheet_name": config.source.sheet_name,
                "header_row": config.source.header_row,
            }
            if source_path_unsafe:
                raw_issues.append(
                    _issue_dict(
                        severity="ERROR",
                        origin="SOURCE_FILE",
                        code="UNSAFE_STORAGE_PATH",
                        message="La ubicación almacenada del archivo fuente no es segura.",
                        blocking=True,
                    ),
                )
            elif not source_file_exists:
                raw_issues.append(
                    _issue_dict(
                        severity="ERROR",
                        origin="SOURCE_FILE",
                        code="SOURCE_FILE_MISSING",
                        message="El archivo físico fuente no existe.",
                        blocking=True,
                    ),
                )

    if ejecucion.estado == "COMPLETADO" and output_record is None:
        raw_issues.append(
            _issue_dict(
                severity="ERROR",
                origin="OUTPUT_FILE",
                code="OUTPUT_FILE_RECORD_MISSING",
                message="No existe el registro del archivo de salida.",
                blocking=False,
            ),
        )
    if output_record is not None and output_path_unsafe:
        raw_issues.append(
            _issue_dict(
                severity="ERROR",
                origin="OUTPUT_FILE",
                code="UNSAFE_STORAGE_PATH",
                message="La ubicación almacenada del archivo de salida no es segura.",
                blocking=False,
            ),
        )
    elif output_record is not None and not output_file_exists:
        raw_issues.append(
            _issue_dict(
                severity="ERROR",
                origin="OUTPUT_FILE",
                code="OUTPUT_FILE_MISSING",
                message="El archivo físico de salida no existe.",
                blocking=False,
            ),
        )

    issues = merge_operational_issues(raw_issues)
    errors_count = sum(
        issue.count for issue in issues if issue.severity == "ERROR"
    )
    warnings_count = sum(
        issue.count for issue in issues if issue.severity == "WARNING"
    )
    has_blocking_issues = any(issue.blocking for issue in issues)
    output_record_exists = output_record is not None

    action_required = determine_transformacion_action_required(
        ejecucion.estado,
        has_configuration,
        validation["available"],
        validation["valid"],
        output_record_exists,
        output_file_exists,
        has_blocking_issues,
    )
    capabilities = determine_transformacion_capabilities(
        ejecucion.estado,
        has_configuration,
        has_blocking_issues,
        source_file_exists,
        output_record_exists,
        output_file_exists,
    )

    recent_events = all_events[:1]
    latest_event_at = (
        parse_operational_datetime(recent_events[0].get("occurred_at"))
        if recent_events
        else None
    )
    timestamp_candidates = [
        parse_operational_datetime(transformacion.get("updated_at")),
        validation.get("validated_at"),
        parse_operational_datetime(
            generation_raw.get("generated_at")
            if isinstance(generation_raw, dict)
            else None,
        ),
        latest_event_at,
        parse_operational_datetime(ejecucion.finished_at),
    ]
    updated_at = max(
        (value for value in timestamp_candidates if value is not None),
        default=None,
    )

    return TransformacionExcelOperationalSummaryRead(
        ejecucion_id=ejecucion.id,
        proceso_id=ejecucion.proceso_id,
        proceso_nombre=ejecucion.proceso.nombre,
        estado_ejecucion=ejecucion.estado,
        action_required=action_required,
        **capabilities,
        has_configuration=has_configuration,
        source=source,
        template=_template_read(transformacion.get("plantilla_aplicada")),
        validation=validation,
        generation=_generation_read(
            generation_raw,
            output_record,
            output_file_exists,
            available=generation_available,
        ),
        issues=issues,
        errors_count=errors_count,
        warnings_count=warnings_count,
        latest_event_at=latest_event_at,
        created_at=parse_operational_datetime(ejecucion.created_at),
        updated_at=updated_at,
    )


def _record_file_status(record: Archivo | None) -> tuple[bool, bool]:
    if record is None:
        return False, False
    try:
        path = resolve_storage_path_safely(record.ruta_storage, STORAGE_ROOT)
        return path.exists() and path.is_file(), False
    except TransformacionExcelSecurityError:
        return False, True
    except (OSError, TypeError, ValueError):
        return False, False


def _find_output_record(
    db: Session,
    ejecucion: EjecucionProceso,
    transformacion: dict[str, Any],
) -> Archivo | None:
    generation = transformacion.get("generacion")
    should_find_output = isinstance(generation, dict) or (
        ejecucion.estado == "COMPLETADO"
    )
    if not should_find_output:
        return None
    generated_file_id = (
        _safe_int(generation.get("archivo_id"))
        if isinstance(generation, dict)
        else None
    )
    if generated_file_id is not None:
        record = db.execute(
            select(Archivo).where(
                Archivo.id == generated_file_id,
                Archivo.ejecucion_id == ejecucion.id,
                Archivo.tipo_archivo == OUTPUT_FILE_TYPE,
            ),
        ).scalar_one_or_none()
        if record is not None:
            return record
    return db.execute(
        select(Archivo)
        .where(
            Archivo.ejecucion_id == ejecucion.id,
            Archivo.tipo_archivo == OUTPUT_FILE_TYPE,
        )
        .order_by(Archivo.id),
    ).scalars().first()


def get_transformacion_operational_summary(
    db: Session,
    ejecucion_id: int,
    current_user: Usuario,
) -> TransformacionExcelOperationalSummaryRead:
    ejecucion = get_transformacion_ejecucion_or_raise(
        db,
        ejecucion_id,
        current_user,
    )
    resumen = ejecucion.resumen_json if isinstance(ejecucion.resumen_json, dict) else {}
    transformacion = resumen.get("transformacion_excel")
    if not isinstance(transformacion, dict):
        transformacion = {}
    config, _ = _valid_persisted_config(transformacion)
    source_record = (
        db.get(Archivo, config.source.archivo_id)
        if config is not None
        else None
    )
    if source_record is not None and source_record.ejecucion_id != ejecucion.id:
        source_record = None
    output_record = _find_output_record(db, ejecucion, transformacion)
    source_file_exists, source_path_unsafe = _record_file_status(source_record)
    output_file_exists, output_path_unsafe = _record_file_status(output_record)
    return build_transformacion_operational_summary(
        ejecucion,
        source_record=source_record,
        source_file_exists=source_file_exists,
        source_path_unsafe=source_path_unsafe,
        output_record=output_record,
        output_file_exists=output_file_exists,
        output_path_unsafe=output_path_unsafe,
    )


def get_transformacion_trace_list(
    db: Session,
    ejecucion_id: int,
    current_user: Usuario,
    limit: int,
) -> dict[str, Any]:
    ejecucion = get_transformacion_ejecucion_or_raise(
        db,
        ejecucion_id,
        current_user,
    )
    all_events = get_transformacion_trace_events(
        ejecucion.resumen_json,
        limit=MAX_TRACE_EVENTS,
    )
    return {
        "ejecucion_id": ejecucion.id,
        "items": all_events[:limit],
        "total": len(all_events),
        "limit": limit,
    }
