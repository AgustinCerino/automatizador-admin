from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Archivo, EjecucionProceso
from app.schemas.conciliacion_archivos import ConciliacionArchivosSelection
from app.services.file_preview_service import (
    UnsupportedPreviewExtensionError,
    validate_preview_extension,
)


CONCILIACION_ARCHIVOS_KEY = "conciliacion_archivos"
CONCILIACION_MAPPING_KEY = "conciliacion_mapping"
CONCILIACION_PROCESS_TYPE = "CONCILIACION_EXCEL"


class ConciliacionArchivosError(Exception):
    status_code = 400


class ConciliacionArchivosNotFoundError(ConciliacionArchivosError):
    status_code = 404


class ConciliacionArchivosAccessDeniedError(ConciliacionArchivosError):
    status_code = 403


def get_authorized_conciliation_execution(
    db: Session,
    ejecucion_id: int,
    cliente_id: int,
) -> EjecucionProceso:
    ejecucion = db.execute(
        select(EjecucionProceso).where(EjecucionProceso.id == ejecucion_id),
    ).scalar_one_or_none()
    if ejecucion is None:
        raise ConciliacionArchivosNotFoundError("Ejecución no encontrada")

    if (
        ejecucion.proceso.cliente_id != cliente_id
        or ejecucion.usuario.cliente_id != cliente_id
    ):
        raise ConciliacionArchivosAccessDeniedError(
            "No tenés permisos para acceder a esta ejecución",
        )

    if ejecucion.proceso.tipo != CONCILIACION_PROCESS_TYPE:
        raise ConciliacionArchivosError(
            "La ejecución no corresponde a una conciliación Excel",
        )

    return ejecucion


def get_archivo(db: Session, archivo_id: int) -> Archivo:
    archivo = db.execute(
        select(Archivo).where(Archivo.id == archivo_id),
    ).scalar_one_or_none()
    if archivo is None:
        raise ConciliacionArchivosNotFoundError(
            f"Archivo no encontrado: {archivo_id}",
        )
    return archivo


def validate_file_for_conciliation(archivo: Archivo) -> None:
    try:
        validate_preview_extension(archivo.extension)
    except UnsupportedPreviewExtensionError as exc:
        raise ConciliacionArchivosError(str(exc)) from exc


def validate_selection_files(
    db: Session,
    ejecucion_id: int,
    selection: ConciliacionArchivosSelection,
) -> tuple[Archivo, Archivo]:
    if selection.archivo_a_id == selection.archivo_b_id:
        raise ConciliacionArchivosError(
            "Los archivos A y B deben ser distintos",
        )

    archivo_a = get_archivo(db, selection.archivo_a_id)
    archivo_b = get_archivo(db, selection.archivo_b_id)

    for archivo in (archivo_a, archivo_b):
        if archivo.ejecucion_id != ejecucion_id:
            raise ConciliacionArchivosError(
                f"El archivo {archivo.id} no pertenece a la ejecución indicada",
            )
        validate_file_for_conciliation(archivo)

    return archivo_a, archivo_b


def parse_stored_selection(value: Any) -> dict[str, int] | None:
    if not isinstance(value, dict):
        return None
    archivo_a_id = value.get("archivo_a_id")
    archivo_b_id = value.get("archivo_b_id")
    if (
        not isinstance(archivo_a_id, int)
        or isinstance(archivo_a_id, bool)
        or archivo_a_id <= 0
        or not isinstance(archivo_b_id, int)
        or isinstance(archivo_b_id, bool)
        or archivo_b_id <= 0
        or archivo_a_id == archivo_b_id
    ):
        return None
    return {
        "archivo_a_id": archivo_a_id,
        "archivo_b_id": archivo_b_id,
    }


def get_explicit_selection(ejecucion: EjecucionProceso) -> dict[str, int] | None:
    resumen_json = ejecucion.resumen_json or {}
    if CONCILIACION_ARCHIVOS_KEY not in resumen_json:
        return None
    selection = parse_stored_selection(resumen_json[CONCILIACION_ARCHIVOS_KEY])
    if selection is None:
        raise ConciliacionArchivosError(
            "La selección de archivos guardada no es válida",
        )
    return selection


def get_historical_mapping_selection(
    ejecucion: EjecucionProceso,
) -> dict[str, int] | None:
    resumen_json = ejecucion.resumen_json or {}
    if CONCILIACION_MAPPING_KEY not in resumen_json:
        return None
    selection = parse_stored_selection(resumen_json[CONCILIACION_MAPPING_KEY])
    if selection is None:
        raise ConciliacionArchivosError(
            "El mapping de conciliación guardado no contiene archivos válidos",
        )
    return selection


def save_conciliacion_archivos(
    db: Session,
    ejecucion_id: int,
    cliente_id: int,
    selection_in: ConciliacionArchivosSelection,
) -> dict[str, int]:
    ejecucion = get_authorized_conciliation_execution(
        db,
        ejecucion_id,
        cliente_id,
    )
    validate_selection_files(db, ejecucion_id, selection_in)
    selection = selection_in.model_dump()

    mapping_selection = get_historical_mapping_selection(ejecucion)
    if mapping_selection is not None and mapping_selection != selection:
        raise ConciliacionArchivosError(
            "La selección debe coincidir con los archivos del mapping existente",
        )

    resumen_json = dict(ejecucion.resumen_json or {})
    resumen_json[CONCILIACION_ARCHIVOS_KEY] = selection
    ejecucion.resumen_json = resumen_json
    db.commit()
    db.refresh(ejecucion)
    return selection


def get_conciliacion_archivos(
    db: Session,
    ejecucion_id: int,
    cliente_id: int,
) -> dict[str, int]:
    ejecucion = get_authorized_conciliation_execution(
        db,
        ejecucion_id,
        cliente_id,
    )
    selection = get_explicit_selection(ejecucion)
    if selection is not None:
        validate_selection_files(
            db,
            ejecucion_id,
            ConciliacionArchivosSelection(**selection),
        )
        return selection

    historical_selection = get_historical_mapping_selection(ejecucion)
    if historical_selection is not None:
        validate_selection_files(
            db,
            ejecucion_id,
            ConciliacionArchivosSelection(**historical_selection),
        )
        return historical_selection

    raise ConciliacionArchivosNotFoundError(
        "La ejecución no tiene archivos de conciliación seleccionados",
    )
