from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

import pandas as pd
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models import Archivo, EjecucionProceso, Usuario
from app.schemas.transformacion_excel import TransformacionExcelConfig
from app.services.transformacion_excel_config_service import (
    TransformacionExcelConfigError,
    collect_referenced_source_columns,
    get_archivo_or_raise,
    get_saved_transformacion_config,
    get_transformacion_ejecucion_or_raise,
    validate_referenced_source_columns,
    validate_execution_is_editable,
    validate_source_file_for_execution,
)
from app.services.transformacion_excel_inspeccion_service import (
    TransformacionExcelInspeccionError,
    get_available_sheets,
    get_raw_headers,
    normalize_column_name,
    normalize_extension,
    read_source_dataframe,
    resolve_existing_storage_path,
    select_sheet_name,
    validate_headers,
)
from app.services.transformacion_excel_pipeline import (
    TransformacionPipelineIssue,
    TransformacionPipelineResult,
    run_transformacion_pipeline,
)


TECHNICAL_ERROR_MESSAGE = "Error técnico al validar la transformación."


class TransformacionExcelValidationTechnicalError(Exception):
    pass


def serialize_json_value(value: Any) -> Any:
    if value is None:
        return None
    try:
        if bool(pd.isna(value)):
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date, pd.Timestamp)):
        return value.isoformat()
    if isinstance(value, dict):
        return {
            str(key): serialize_json_value(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [serialize_json_value(item) for item in value]
    if hasattr(value, "item"):
        return serialize_json_value(value.item())
    return value


def read_configured_source_dataframe(
    archivo: Archivo,
    config: TransformacionExcelConfig,
) -> pd.DataFrame:
    extension = normalize_extension(archivo.extension)
    path = resolve_existing_storage_path(archivo)
    available_sheets = get_available_sheets(path, extension)
    selected_sheet_name = select_sheet_name(
        extension,
        available_sheets,
        config.source.sheet_name,
    )
    raw_headers = get_raw_headers(
        path,
        extension,
        selected_sheet_name,
        config.source.header_row,
    )
    dataframe = read_source_dataframe(
        path,
        extension,
        selected_sheet_name,
        config.source.header_row,
    )

    if len(raw_headers) == len(dataframe.columns):
        dataframe.columns = raw_headers

    column_names = [
        normalize_column_name(column)
        for column in dataframe.columns
    ]
    validate_headers(column_names)
    dataframe.columns = column_names
    return dataframe.reset_index(drop=True)


def issue_to_dict(
    issue: TransformacionPipelineIssue,
) -> dict[str, Any]:
    return {
        "code": issue.code,
        "message": issue.message,
        "output_column": issue.output_column,
        "source_column": issue.source_column,
        "count": issue.count,
        "sample_rows": [
            {
                str(key): serialize_json_value(value)
                for key, value in sample.items()
            }
            for sample in issue.samples
        ],
    }


def build_preview_rows(
    result: TransformacionPipelineResult,
    preview_limit: int,
) -> list[dict[str, object]]:
    return [
        {
            column: serialize_json_value(row[column])
            for column in result.output_columns
        }
        for _, row in result.final_dataframe.head(preview_limit).iterrows()
    ]


def build_pipeline_response(
    result: TransformacionPipelineResult,
    preview_limit: int,
) -> dict[str, Any]:
    metrics = result.metrics
    return {
        "valid": result.valid,
        "total_filas_entrada": metrics.total_filas_entrada,
        "filas_despues_filtros": metrics.filas_despues_filtros,
        "filas_excluidas_por_filtros": (
            metrics.filas_excluidas_por_filtros
        ),
        "filas_validas": metrics.filas_validas,
        "filas_con_errores": metrics.filas_con_errores,
        "filas_con_advertencias": metrics.filas_con_advertencias,
        "duplicados_detectados": metrics.duplicados_detectados,
        "duplicados_eliminados": metrics.duplicados_eliminados,
        "columnas_salida": result.output_columns,
        "preview_rows": build_preview_rows(result, preview_limit),
        "errors": [issue_to_dict(issue) for issue in result.errors],
        "warnings": [issue_to_dict(issue) for issue in result.warnings],
    }


def get_persisted_config(
    db: Session,
    ejecucion_id: int,
    current_user: Usuario,
) -> TransformacionExcelConfig:
    try:
        saved_config = get_saved_transformacion_config(
            db,
            ejecucion_id,
            current_user,
        )
        return TransformacionExcelConfig.model_validate(
            saved_config["configuracion"],
        )
    except TransformacionExcelConfigError:
        raise
    except (ValidationError, TypeError, ValueError) as exc:
        raise TransformacionExcelConfigError(
            "La configuración de transformación persistida es inválida.",
        ) from exc


def run_dry_run(
    archivo: Archivo,
    config: TransformacionExcelConfig,
    preview_limit: int,
) -> dict[str, Any]:
    try:
        source_dataframe = read_configured_source_dataframe(
            archivo,
            config,
        )
    except TransformacionExcelInspeccionError as exc:
        raise TransformacionExcelConfigError(
            str(exc),
            exc.status_code,
        ) from exc

    validate_referenced_source_columns(
        collect_referenced_source_columns(config),
        [str(column) for column in source_dataframe.columns],
    )
    result = run_transformacion_pipeline(
        source_dataframe,
        config,
    )
    return build_pipeline_response(result, preview_limit)


def build_persisted_validation(
    pipeline_result: dict[str, Any],
    validated_at: datetime,
) -> dict[str, Any]:
    return {
        "valid": pipeline_result["valid"],
        "total_filas_entrada": pipeline_result["total_filas_entrada"],
        "filas_despues_filtros": pipeline_result["filas_despues_filtros"],
        "filas_excluidas_por_filtros": (
            pipeline_result["filas_excluidas_por_filtros"]
        ),
        "filas_validas": pipeline_result["filas_validas"],
        "filas_con_errores": pipeline_result["filas_con_errores"],
        "filas_con_advertencias": (
            pipeline_result["filas_con_advertencias"]
        ),
        "duplicados_detectados": pipeline_result["duplicados_detectados"],
        "duplicados_eliminados": pipeline_result["duplicados_eliminados"],
        "columnas_salida": pipeline_result["columnas_salida"],
        "preview_rows": pipeline_result["preview_rows"],
        "errors": pipeline_result["errors"],
        "warnings": pipeline_result["warnings"],
        "validated_at": validated_at.isoformat(),
    }


def persist_validation_result(
    db: Session,
    ejecucion: EjecucionProceso,
    pipeline_result: dict[str, Any],
    validated_at: datetime,
) -> dict[str, Any]:
    resumen_json = dict(ejecucion.resumen_json or {})
    transformacion_excel = dict(
        resumen_json.get("transformacion_excel") or {},
    )
    transformacion_excel["validacion"] = build_persisted_validation(
        pipeline_result,
        validated_at,
    )
    resumen_json["transformacion_excel"] = transformacion_excel

    ejecucion.resumen_json = resumen_json
    ejecucion.estado = (
        "VALIDADO"
        if pipeline_result["valid"]
        else "CONFIGURADO"
    )
    ejecucion.error_message = None

    db.commit()
    db.refresh(ejecucion)
    return {
        "ejecucion_id": ejecucion.id,
        **pipeline_result,
        "estado_ejecucion": ejecucion.estado,
        "validated_at": validated_at,
    }


def mark_execution_as_technical_error(
    db: Session,
    ejecucion_id: int,
) -> None:
    db.rollback()
    try:
        ejecucion = db.get(EjecucionProceso, ejecucion_id)
        if ejecucion is None:
            return
        ejecucion.estado = "ERROR"
        ejecucion.error_message = TECHNICAL_ERROR_MESSAGE
        db.commit()
    except Exception:
        db.rollback()


def validate_transformacion_execution(
    db: Session,
    ejecucion_id: int,
    current_user: Usuario,
    preview_limit: int,
) -> dict[str, Any]:
    ejecucion = get_transformacion_ejecucion_or_raise(
        db,
        ejecucion_id,
        current_user,
    )

    try:
        validate_execution_is_editable(ejecucion)
        config = get_persisted_config(db, ejecucion_id, current_user)
        archivo = get_archivo_or_raise(db, config.source.archivo_id)
        validate_source_file_for_execution(archivo, ejecucion_id)

        pipeline_result = run_dry_run(
            archivo,
            config,
            preview_limit,
        )
        return persist_validation_result(
            db,
            ejecucion,
            pipeline_result,
            datetime.now(timezone.utc),
        )
    except TransformacionExcelConfigError:
        raise
    except Exception as exc:
        mark_execution_as_technical_error(db, ejecucion_id)
        raise TransformacionExcelValidationTechnicalError(
            TECHNICAL_ERROR_MESSAGE,
        ) from exc
