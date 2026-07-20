from datetime import datetime, timezone
from typing import Any

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
)
from app.services.transformacion_excel_pipeline import (
    read_configured_source_dataframe,
    run_transformacion_pipeline,
)


TECHNICAL_ERROR_MESSAGE = "Error técnico al validar la transformación."


class TransformacionExcelValidationTechnicalError(Exception):
    pass


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
            config.source,
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
    return run_transformacion_pipeline(
        source_dataframe,
        config,
        preview_limit,
    )


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
