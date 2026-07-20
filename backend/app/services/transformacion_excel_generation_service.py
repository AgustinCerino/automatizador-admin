from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Archivo, EjecucionProceso, Usuario
from app.schemas.transformacion_excel import TransformacionExcelConfig
from app.services.file_preview_service import resolve_storage_path
from app.services.file_service import STORAGE_ROOT, calculate_sha256
from app.services.transformacion_excel_config_service import (
    TransformacionExcelConfigError,
    collect_referenced_source_columns,
    get_archivo_or_raise,
    get_transformacion_ejecucion_or_raise,
    validate_referenced_source_columns,
    validate_source_file_for_execution,
)
from app.services.transformacion_excel_pipeline import (
    run_transformacion_pipeline,
)
from app.services.transformacion_excel_validation_service import (
    build_pipeline_response,
    get_persisted_config,
    persist_validation_result,
    read_configured_source_dataframe,
)
from app.services.transformacion_excel_xlsx_writer import (
    TransformacionExcelXlsxWriterError,
    build_output_path,
    validate_output_file_name,
    validate_sheet_name,
    write_transformacion_xlsx,
)


OUTPUT_FILE_TYPE = "EXCEL_OUTPUT"
OUTPUT_EXTENSION = ".xlsx"
OUTPUT_MIME_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)
PROCESSED_STORAGE_ROOT = STORAGE_ROOT / "processed"
GENERATION_TECHNICAL_ERROR_MESSAGE = (
    "Error técnico al generar la transformación."
)


class TransformacionExcelGenerationError(Exception):
    status_code = 400

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        if status_code is not None:
            self.status_code = status_code


class TransformacionExcelGenerationNotFoundError(
    TransformacionExcelGenerationError,
):
    status_code = 404


class TransformacionExcelGenerationConflictError(
    TransformacionExcelGenerationError,
):
    status_code = 409


class TransformacionExcelGenerationTechnicalError(Exception):
    pass


@dataclass(frozen=True)
class TransformacionExcelDownload:
    path: Path
    filename: str
    media_type: str


def get_output_records(
    db: Session,
    ejecucion_id: int,
) -> list[Archivo]:
    return list(
        db.execute(
            select(Archivo)
            .where(
                Archivo.ejecucion_id == ejecucion_id,
                Archivo.tipo_archivo == OUTPUT_FILE_TYPE,
            )
            .order_by(Archivo.id),
        ).scalars().all(),
    )


def processed_execution_directory(ejecucion_id: int) -> Path:
    return PROCESSED_STORAGE_ROOT / str(ejecucion_id)


def resolve_valid_output_path(
    archivo: Archivo,
    ejecucion_id: int,
) -> Path | None:
    path = resolve_storage_path(archivo.ruta_storage).resolve()
    allowed_directory = processed_execution_directory(ejecucion_id).resolve()
    if not path.is_relative_to(allowed_directory):
        return None
    if not path.exists() or not path.is_file() or path.stat().st_size <= 0:
        return None
    if archivo.size_bytes is not None and path.stat().st_size != archivo.size_bytes:
        return None
    if archivo.checksum is not None and calculate_sha256(path) != archivo.checksum:
        return None
    return path


def calculate_config_checksum(config: TransformacionExcelConfig) -> str:
    serialized = json.dumps(
        config.model_dump(mode="json"),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def parse_generated_at(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def generation_summary(
    ejecucion: EjecucionProceso,
) -> dict[str, Any]:
    return (
        ((ejecucion.resumen_json or {}).get("transformacion_excel") or {}).get(
            "generacion",
        )
        or {}
    )


def build_generation_response(
    ejecucion: EjecucionProceso,
    archivo: Archivo,
    path: Path,
    *,
    reused: bool,
) -> dict[str, Any]:
    summary = generation_summary(ejecucion)
    generated_at = (
        parse_generated_at(summary.get("generated_at"))
        or archivo.uploaded_at
        or datetime.now(timezone.utc)
    )
    checksum = archivo.checksum or calculate_sha256(path)
    size_bytes = path.stat().st_size
    return {
        "ejecucion_id": ejecucion.id,
        "estado_ejecucion": ejecucion.estado,
        "archivo_id": archivo.id,
        "nombre_archivo": archivo.nombre_original,
        "extension": archivo.extension or OUTPUT_EXTENSION,
        "mime_type": archivo.mime_type or OUTPUT_MIME_TYPE,
        "size_bytes": size_bytes,
        "checksum": checksum,
        "total_filas": int(summary.get("total_filas") or 0),
        "columnas_salida": list(summary.get("columnas_salida") or []),
        "generated_at": generated_at,
        "reused": reused,
    }


def validate_generation_state(ejecucion: EjecucionProceso) -> None:
    if ejecucion.estado == "VALIDADO":
        return
    if ejecucion.estado == "PROCESANDO":
        raise TransformacionExcelGenerationConflictError(
            "La transformación ya está siendo procesada.",
        )
    if ejecucion.estado == "CONFIGURADO":
        raise TransformacionExcelGenerationConflictError(
            "La transformación debe validarse antes de generar el resultado.",
        )
    if ejecucion.estado == "ERROR":
        raise TransformacionExcelGenerationConflictError(
            "La transformación debe validarse nuevamente antes de generar.",
        )
    if ejecucion.estado in {"CANCELADO", "APROBADO", "RECHAZADO"}:
        raise TransformacionExcelGenerationError(
            f"No se puede generar una ejecución en estado {ejecucion.estado}.",
        )
    if ejecucion.estado != "COMPLETADO":
        raise TransformacionExcelGenerationConflictError(
            "La transformación debe estar validada antes de generar.",
        )


def validate_output_config(config: TransformacionExcelConfig) -> None:
    try:
        validate_output_file_name(config.output.file_name)
        validate_sheet_name(config.output.sheet_name)
    except TransformacionExcelXlsxWriterError as exc:
        raise TransformacionExcelGenerationError(str(exc)) from exc


def mark_generation_as_technical_error(
    db: Session,
    ejecucion_id: int,
) -> None:
    db.rollback()
    try:
        ejecucion = db.get(EjecucionProceso, ejecucion_id)
        if ejecucion is None:
            return
        ejecucion.estado = "ERROR"
        ejecucion.error_message = GENERATION_TECHNICAL_ERROR_MESSAGE
        ejecucion.finished_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()


def remove_file_if_present(path: Path | None) -> None:
    if path is None:
        return
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def upsert_output_record(
    db: Session,
    ejecucion_id: int,
    output_path: Path,
    file_name: str,
    checksum: str,
    size_bytes: int,
) -> tuple[Archivo, list[Path]]:
    records = get_output_records(db, ejecucion_id)
    archivo = records[0] if records else Archivo(ejecucion_id=ejecucion_id)
    obsolete_paths: list[Path] = []

    if records:
        previous_path = resolve_storage_path(archivo.ruta_storage).resolve()
        if previous_path != output_path.resolve():
            obsolete_paths.append(previous_path)
    else:
        db.add(archivo)

    for duplicate_record in records[1:]:
        duplicate_path = resolve_storage_path(
            duplicate_record.ruta_storage,
        ).resolve()
        if duplicate_path != output_path.resolve():
            obsolete_paths.append(duplicate_path)
        db.delete(duplicate_record)

    archivo.tipo_archivo = OUTPUT_FILE_TYPE
    archivo.nombre_original = file_name
    archivo.ruta_storage = output_path.relative_to(
        STORAGE_ROOT.parent,
    ).as_posix()
    archivo.extension = OUTPUT_EXTENSION
    archivo.mime_type = OUTPUT_MIME_TYPE
    archivo.size_bytes = size_bytes
    archivo.checksum = checksum
    db.flush()
    return archivo, obsolete_paths


def persist_generation_result(
    db: Session,
    ejecucion: EjecucionProceso,
    source_file: Archivo,
    config: TransformacionExcelConfig,
    output_path: Path,
    total_rows: int,
    output_columns: list[str],
    generated_at: datetime,
) -> tuple[Archivo, list[Path]]:
    size_bytes = output_path.stat().st_size
    output_checksum = calculate_sha256(output_path)
    source_checksum = source_file.checksum or calculate_sha256(
        resolve_storage_path(source_file.ruta_storage),
    )
    archivo, obsolete_paths = upsert_output_record(
        db,
        ejecucion.id,
        output_path,
        config.output.file_name,
        output_checksum,
        size_bytes,
    )

    resumen_json = dict(ejecucion.resumen_json or {})
    transformacion_excel = dict(
        resumen_json.get("transformacion_excel") or {},
    )
    transformacion_excel["generacion"] = {
        "archivo_id": archivo.id,
        "nombre_archivo": config.output.file_name,
        "total_filas": total_rows,
        "columnas_salida": output_columns,
        "size_bytes": size_bytes,
        "checksum": output_checksum,
        "generated_at": generated_at.isoformat(),
        "config_checksum": calculate_config_checksum(config),
        "source_checksum": source_checksum,
    }
    resumen_json["transformacion_excel"] = transformacion_excel

    ejecucion.resumen_json = resumen_json
    ejecucion.estado = "COMPLETADO"
    ejecucion.error_message = None
    ejecucion.finished_at = generated_at
    db.commit()
    db.refresh(archivo)
    db.refresh(ejecucion)
    return archivo, obsolete_paths


def generate_transformacion_result(
    db: Session,
    ejecucion_id: int,
    current_user: Usuario,
) -> dict[str, Any]:
    ejecucion = get_transformacion_ejecucion_or_raise(
        db,
        ejecucion_id,
        current_user,
    )
    db.refresh(ejecucion, with_for_update=True)

    config = get_persisted_config(db, ejecucion_id, current_user)
    source_file = get_archivo_or_raise(db, config.source.archivo_id)
    validate_source_file_for_execution(source_file, ejecucion_id)
    validate_output_config(config)

    records = get_output_records(db, ejecucion_id)
    if ejecucion.estado == "COMPLETADO" and records:
        existing_path = resolve_valid_output_path(records[0], ejecucion_id)
        if existing_path is not None:
            db.rollback()
            return build_generation_response(
                ejecucion,
                records[0],
                existing_path,
                reused=True,
            )

    validate_generation_state(ejecucion)
    ejecucion.estado = "PROCESANDO"
    ejecucion.error_message = None
    ejecucion.finished_at = None
    db.commit()

    output_path: Path | None = None
    output_existed_before = False
    try:
        source_dataframe = read_configured_source_dataframe(
            source_file,
            config,
        )
        validate_referenced_source_columns(
            collect_referenced_source_columns(config),
            [str(column) for column in source_dataframe.columns],
        )
        result = run_transformacion_pipeline(source_dataframe, config)
        if not result.valid:
            validation_payload = build_pipeline_response(result, 20)
            persist_validation_result(
                db,
                ejecucion,
                validation_payload,
                datetime.now(timezone.utc),
            )
            raise TransformacionExcelGenerationConflictError(
                "La transformación contiene errores y debe validarse nuevamente.",
            )

        output_directory = processed_execution_directory(ejecucion_id)
        output_path = build_output_path(
            output_directory,
            config.output.file_name,
        )
        output_existed_before = output_path.exists()
        write_transformacion_xlsx(
            result.final_dataframe,
            config,
            output_path,
        )

        generated_at = datetime.now(timezone.utc)
        archivo, obsolete_paths = persist_generation_result(
            db,
            ejecucion,
            source_file,
            config,
            output_path,
            len(result.final_dataframe),
            result.output_columns,
            generated_at,
        )
        for obsolete_path in obsolete_paths:
            allowed_directory = processed_execution_directory(
                ejecucion_id,
            ).resolve()
            if obsolete_path.is_relative_to(allowed_directory):
                remove_file_if_present(obsolete_path)

        return build_generation_response(
            ejecucion,
            archivo,
            output_path,
            reused=False,
        )
    except (
        TransformacionExcelConfigError,
        TransformacionExcelGenerationError,
    ):
        raise
    except Exception as exc:
        if output_path is not None and not output_existed_before:
            remove_file_if_present(output_path)
        mark_generation_as_technical_error(db, ejecucion_id)
        raise TransformacionExcelGenerationTechnicalError(
            GENERATION_TECHNICAL_ERROR_MESSAGE,
        ) from exc


def get_transformacion_result(
    db: Session,
    ejecucion_id: int,
    current_user: Usuario,
) -> dict[str, Any]:
    ejecucion = get_transformacion_ejecucion_or_raise(
        db,
        ejecucion_id,
        current_user,
    )
    if ejecucion.estado == "PROCESANDO":
        raise TransformacionExcelGenerationConflictError(
            "La transformación todavía está siendo procesada.",
        )
    if ejecucion.estado != "COMPLETADO":
        raise TransformacionExcelGenerationNotFoundError(
            "La ejecución todavía no tiene un resultado generado.",
        )

    records = get_output_records(db, ejecucion_id)
    if not records:
        raise TransformacionExcelGenerationNotFoundError(
            "No se encontró el archivo de resultado.",
        )
    path = resolve_valid_output_path(records[0], ejecucion_id)
    if path is None:
        raise TransformacionExcelGenerationNotFoundError(
            "El archivo físico de resultado no existe.",
        )
    return build_generation_response(
        ejecucion,
        records[0],
        path,
        reused=True,
    )


def get_transformacion_result_download(
    db: Session,
    ejecucion_id: int,
    current_user: Usuario,
) -> TransformacionExcelDownload:
    get_transformacion_result(db, ejecucion_id, current_user)
    records = get_output_records(db, ejecucion_id)
    path = resolve_valid_output_path(records[0], ejecucion_id)
    if path is None:
        raise TransformacionExcelGenerationNotFoundError(
            "El archivo físico de resultado no existe.",
        )
    return TransformacionExcelDownload(
        path=path,
        filename=records[0].nombre_original,
        media_type=OUTPUT_MIME_TYPE,
    )
