from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Archivo, EjecucionProceso
from app.schemas.conciliacion_mapping import ConciliacionMappingCreate
from app.services.file_preview_service import (
    FilePreviewError,
    UnsupportedPreviewExtensionError,
    get_file_columns,
)


class ConciliacionMappingError(Exception):
    status_code = 400


class ConciliacionResourceNotFoundError(ConciliacionMappingError):
    status_code = 404


class ConciliacionMappingNotFoundError(ConciliacionMappingError):
    status_code = 404


def get_ejecucion(db: Session, ejecucion_id: int) -> EjecucionProceso:
    ejecucion = db.execute(
        select(EjecucionProceso).where(EjecucionProceso.id == ejecucion_id),
    ).scalar_one_or_none()
    if ejecucion is None:
        raise ConciliacionResourceNotFoundError("Ejecución no encontrada")
    return ejecucion


def get_archivo(db: Session, archivo_id: int) -> Archivo:
    archivo = db.execute(
        select(Archivo).where(Archivo.id == archivo_id),
    ).scalar_one_or_none()
    if archivo is None:
        raise ConciliacionResourceNotFoundError(
            f"Archivo no encontrado: {archivo_id}",
        )
    return archivo


def validate_archivo_belongs_to_ejecucion(
    archivo: Archivo,
    ejecucion_id: int,
) -> None:
    if archivo.ejecucion_id != ejecucion_id:
        raise ConciliacionMappingError(
            f"El archivo {archivo.id} no pertenece a la ejecución indicada",
        )


def validate_required_columns(
    available_columns: list[str],
    required_columns: list[str],
    label: str,
) -> None:
    missing_columns = [
        column for column in required_columns if column not in available_columns
    ]
    if missing_columns:
        missing = ", ".join(missing_columns)
        raise ConciliacionMappingError(
            f"Columnas inexistentes en archivo {label}: {missing}",
        )


def read_columns(archivo: Archivo) -> list[str]:
    try:
        return get_file_columns(archivo)
    except UnsupportedPreviewExtensionError as exc:
        raise ConciliacionMappingError(str(exc)) from exc
    except FilePreviewError as exc:
        raise ConciliacionMappingError(str(exc)) from exc


def save_conciliacion_mapping(
    db: Session,
    ejecucion_id: int,
    mapping_in: ConciliacionMappingCreate,
) -> dict[str, Any]:
    ejecucion = get_ejecucion(db, ejecucion_id)

    if mapping_in.archivo_a_id == mapping_in.archivo_b_id:
        raise ConciliacionMappingError("Los archivos A y B deben ser distintos")

    archivo_a = get_archivo(db, mapping_in.archivo_a_id)
    archivo_b = get_archivo(db, mapping_in.archivo_b_id)

    validate_archivo_belongs_to_ejecucion(archivo_a, ejecucion_id)
    validate_archivo_belongs_to_ejecucion(archivo_b, ejecucion_id)

    columnas_archivo_a = read_columns(archivo_a)
    columnas_archivo_b = read_columns(archivo_b)

    validate_required_columns(
        columnas_archivo_a,
        [
            mapping_in.columna_clave_archivo_a,
            mapping_in.columna_importe_archivo_a,
        ],
        "A",
    )
    validate_required_columns(
        columnas_archivo_b,
        [
            mapping_in.columna_clave_archivo_b,
            mapping_in.columna_importe_archivo_b,
        ],
        "B",
    )

    mapping = {
        **mapping_in.model_dump(),
        "columnas_archivo_a": columnas_archivo_a,
        "columnas_archivo_b": columnas_archivo_b,
    }
    resumen_json = dict(ejecucion.resumen_json or {})
    resumen_json["conciliacion_mapping"] = mapping
    ejecucion.resumen_json = resumen_json

    db.commit()
    db.refresh(ejecucion)
    return mapping


def get_conciliacion_mapping(
    db: Session,
    ejecucion_id: int,
) -> dict[str, Any]:
    ejecucion = get_ejecucion(db, ejecucion_id)
    mapping = (ejecucion.resumen_json or {}).get("conciliacion_mapping")
    if mapping is None:
        raise ConciliacionMappingNotFoundError(
            "La ejecución no tiene un mapping de conciliación guardado",
        )
    return mapping
