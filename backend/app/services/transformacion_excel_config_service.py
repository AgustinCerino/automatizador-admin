from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Archivo, EjecucionProceso, Usuario
from app.schemas.transformacion_excel import TransformacionExcelConfig
from app.services.transformacion_excel_inspeccion_service import (
    TransformacionExcelInspeccionError,
    build_transformacion_excel_structure,
    normalize_extension,
    resolve_existing_storage_path,
)


TERMINAL_EXECUTION_STATES = {"COMPLETADO", "CANCELADO", "APROBADO", "RECHAZADO"}


class TransformacionExcelConfigError(Exception):
    status_code = 400

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        if status_code is not None:
            self.status_code = status_code


class TransformacionExcelConfigNotFoundError(TransformacionExcelConfigError):
    status_code = 404


class TransformacionExcelConfigForbiddenError(TransformacionExcelConfigError):
    status_code = 403


def get_transformacion_ejecucion_or_raise(
    db: Session,
    ejecucion_id: int,
    current_user: Usuario,
) -> EjecucionProceso:
    ejecucion = db.execute(
        select(EjecucionProceso).where(EjecucionProceso.id == ejecucion_id),
    ).scalar_one_or_none()
    if ejecucion is None:
        raise TransformacionExcelConfigNotFoundError("Ejecución no encontrada")

    if ejecucion.proceso.tipo != "TRANSFORMACION_EXCEL":
        raise TransformacionExcelConfigError(
            "La ejecución no pertenece a un proceso TRANSFORMACION_EXCEL",
        )

    if ejecucion.proceso.cliente_id != current_user.cliente_id:
        raise TransformacionExcelConfigForbiddenError(
            "La ejecución pertenece a otro cliente",
        )

    return ejecucion


def validate_execution_is_editable(ejecucion: EjecucionProceso) -> None:
    if ejecucion.estado in TERMINAL_EXECUTION_STATES:
        raise TransformacionExcelConfigError(
            f"No se puede configurar una ejecución en estado {ejecucion.estado}",
        )


def get_archivo_or_raise(db: Session, archivo_id: int) -> Archivo:
    archivo = db.execute(
        select(Archivo).where(Archivo.id == archivo_id),
    ).scalar_one_or_none()
    if archivo is None:
        raise TransformacionExcelConfigNotFoundError("Archivo fuente no encontrado")
    return archivo


def validate_source_file_for_execution(
    archivo: Archivo,
    ejecucion_id: int,
) -> None:
    if archivo.ejecucion_id != ejecucion_id:
        raise TransformacionExcelConfigError(
            "El archivo fuente no pertenece a la ejecución indicada",
        )
    try:
        normalize_extension(archivo.extension)
        resolve_existing_storage_path(archivo)
    except TransformacionExcelInspeccionError as exc:
        raise TransformacionExcelConfigError(str(exc), exc.status_code) from exc


def get_available_source_columns(
    db: Session,
    config: TransformacionExcelConfig,
) -> list[str]:
    try:
        structure = build_transformacion_excel_structure(
            db=db,
            archivo_id=config.source.archivo_id,
            sheet_name=config.source.sheet_name,
            header_row=config.source.header_row,
            limit=1,
        )
    except TransformacionExcelInspeccionError as exc:
        raise TransformacionExcelConfigError(str(exc), exc.status_code) from exc

    return [column["name"] for column in structure["columns"]]


def collect_referenced_source_columns(
    config: TransformacionExcelConfig,
) -> set[str]:
    columns: set[str] = set()

    for output_column in config.output_columns:
        if output_column.operation == "SOURCE":
            columns.add(output_column.source_column)
        elif output_column.operation == "CONCAT":
            columns.update(
                part.value
                for part in output_column.parts
                if part.type == "SOURCE"
            )
        elif output_column.operation == "ARITHMETIC":
            for operand in (
                output_column.left_operand,
                output_column.right_operand,
            ):
                if operand.type == "SOURCE":
                    columns.add(operand.value)
        elif output_column.operation == "VALUE_MAP":
            columns.add(output_column.source_column)

    columns.update(rule.source_column for rule in config.rows.filters)
    return columns


def validate_referenced_source_columns(
    referenced_columns: set[str],
    available_columns: list[str],
) -> None:
    available = set(available_columns)
    missing_columns = sorted(referenced_columns - available)
    if missing_columns:
        missing = ", ".join(missing_columns)
        raise TransformacionExcelConfigError(
            f"Columnas fuente inexistentes en el archivo: {missing}",
        )


def parse_updated_at(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value)
    return None


def build_config_response(
    ejecucion: EjecucionProceso,
    config: TransformacionExcelConfig,
    updated_at: datetime | None,
) -> dict[str, Any]:
    return {
        "ejecucion_id": ejecucion.id,
        "estado_ejecucion": ejecucion.estado,
        "configuracion": config,
        "updated_at": updated_at,
    }


def save_transformacion_config(
    db: Session,
    ejecucion_id: int,
    config: TransformacionExcelConfig,
    current_user: Usuario,
) -> dict[str, Any]:
    ejecucion = get_transformacion_ejecucion_or_raise(
        db,
        ejecucion_id,
        current_user,
    )
    validate_execution_is_editable(ejecucion)

    archivo = get_archivo_or_raise(db, config.source.archivo_id)
    validate_source_file_for_execution(archivo, ejecucion_id)
    available_columns = get_available_source_columns(db, config)
    referenced_columns = collect_referenced_source_columns(config)
    validate_referenced_source_columns(referenced_columns, available_columns)

    now = datetime.now(timezone.utc)
    resumen_json = dict(ejecucion.resumen_json or {})
    transformacion_excel = dict(resumen_json.get("transformacion_excel") or {})
    transformacion_excel["configuracion"] = config.model_dump(mode="json")
    transformacion_excel["updated_at"] = now.isoformat()
    resumen_json["transformacion_excel"] = transformacion_excel

    ejecucion.resumen_json = resumen_json
    ejecucion.estado = "CONFIGURADO"
    ejecucion.error_message = None

    db.commit()
    db.refresh(ejecucion)
    return build_config_response(ejecucion, config, now)


def get_saved_transformacion_config(
    db: Session,
    ejecucion_id: int,
    current_user: Usuario,
) -> dict[str, Any]:
    ejecucion = get_transformacion_ejecucion_or_raise(
        db,
        ejecucion_id,
        current_user,
    )
    transformacion_excel = (ejecucion.resumen_json or {}).get(
        "transformacion_excel",
    ) or {}
    raw_config = transformacion_excel.get("configuracion")
    if raw_config is None:
        raise TransformacionExcelConfigNotFoundError(
            "La ejecución no tiene una configuración de transformación guardada.",
        )

    config = TransformacionExcelConfig.model_validate(raw_config)
    updated_at = parse_updated_at(transformacion_excel.get("updated_at"))
    return build_config_response(ejecucion, config, updated_at)
