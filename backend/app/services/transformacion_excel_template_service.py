from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ConfiguracionProceso, Proceso, Usuario
from app.schemas.transformacion_excel import TransformacionExcelConfig
from app.schemas.transformacion_excel_plantilla import (
    TransformacionExcelTemplateConfig,
    TransformacionExcelTemplateCreate,
    TransformacionExcelTemplateUpdate,
)
from app.services.transformacion_excel_config_service import (
    build_config_response,
    collect_referenced_source_columns,
    get_archivo_or_raise,
    get_available_source_columns,
    get_saved_transformacion_config,
    get_transformacion_ejecucion_or_raise,
    validate_referenced_source_columns,
    validate_source_file_for_execution,
)


TEMPLATE_MODULE = "TRANSFORMACION_EXCEL"
TEMPLATE_SCHEMA_VERSION = 1
TEMPLATE_CREATION_STATES = {"CONFIGURADO", "VALIDADO", "COMPLETADO", "ERROR"}
TEMPLATE_APPLICATION_BLOCKED_STATES = {
    "COMPLETADO",
    "CANCELADO",
    "APROBADO",
    "RECHAZADO",
    "PROCESANDO",
}


class TransformacionExcelTemplateError(Exception):
    status_code = 400

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        if status_code is not None:
            self.status_code = status_code


class TransformacionExcelTemplateNotFoundError(TransformacionExcelTemplateError):
    status_code = 404


class TransformacionExcelTemplateForbiddenError(
    TransformacionExcelTemplateError,
):
    status_code = 403


class TransformacionExcelTemplateConflictError(TransformacionExcelTemplateError):
    status_code = 409


def build_template_from_execution_config(
    config: TransformacionExcelConfig,
) -> TransformacionExcelTemplateConfig:
    raw_config = config.model_dump(mode="json")
    raw_config["source"].pop("archivo_id", None)
    return TransformacionExcelTemplateConfig.model_validate(raw_config)


def build_execution_config_from_template(
    template: TransformacionExcelTemplateConfig,
    archivo_id: int,
    sheet_name: str | None = None,
    header_row: int | None = None,
) -> TransformacionExcelConfig:
    raw_template = template.model_dump(mode="json")
    source = raw_template["source"]
    source["archivo_id"] = archivo_id
    if sheet_name is not None:
        source["sheet_name"] = sheet_name
    if header_row is not None:
        source["header_row"] = header_row
    return TransformacionExcelConfig.model_validate(raw_template)


def serialize_template_config_json(
    template: TransformacionExcelTemplateConfig,
    descripcion: str | None = None,
) -> dict[str, Any]:
    return {
        "modulo": TEMPLATE_MODULE,
        "schema_version": TEMPLATE_SCHEMA_VERSION,
        "descripcion": descripcion,
        "template": template.model_dump(mode="json"),
    }


def parse_template_config_json(
    config_json: object,
) -> TransformacionExcelTemplateConfig:
    if not isinstance(config_json, dict):
        raise TransformacionExcelTemplateError(
            "La configuración almacenada de la plantilla es inválida",
        )
    if config_json.get("modulo") != TEMPLATE_MODULE:
        raise TransformacionExcelTemplateError(
            "La configuración no es una plantilla TRANSFORMACION_EXCEL",
        )
    schema_version = config_json.get("schema_version")
    if (
        type(schema_version) is not int
        or schema_version != TEMPLATE_SCHEMA_VERSION
    ):
        raise TransformacionExcelTemplateError(
            "La versión de la plantilla no está soportada",
        )
    try:
        return TransformacionExcelTemplateConfig.model_validate(
            config_json.get("template"),
        )
    except ValidationError as exc:
        raise TransformacionExcelTemplateError(
            "La configuración almacenada de la plantilla es inválida",
        ) from exc


def _get_template_description(config_json: object) -> str | None:
    if not isinstance(config_json, dict):
        return None
    description = config_json.get("descripcion")
    return description if isinstance(description, str) else None


def _is_template_config(config_json: object) -> bool:
    return (
        isinstance(config_json, dict)
        and config_json.get("modulo") == TEMPLATE_MODULE
    )


def _build_template_response(
    template_record: ConfiguracionProceso,
) -> dict[str, Any]:
    template = parse_template_config_json(template_record.config_json)
    config_json = template_record.config_json
    return {
        "id": template_record.id,
        "proceso_id": template_record.proceso_id,
        "nombre": template_record.nombre,
        "descripcion": _get_template_description(config_json),
        "activo": template_record.activo,
        "configuracion": template,
        "schema_version": config_json["schema_version"],
        "created_at": template_record.created_at,
        "updated_at": template_record.updated_at,
    }


def _get_process_or_raise(
    db: Session,
    proceso_id: int,
    current_user: Usuario,
) -> Proceso:
    proceso = db.execute(
        select(Proceso).where(Proceso.id == proceso_id),
    ).scalar_one_or_none()
    if proceso is None:
        raise TransformacionExcelTemplateNotFoundError("Proceso no encontrado")
    if proceso.tipo != TEMPLATE_MODULE:
        raise TransformacionExcelTemplateError(
            "El proceso no es de tipo TRANSFORMACION_EXCEL",
        )
    if proceso.cliente_id != current_user.cliente_id:
        raise TransformacionExcelTemplateForbiddenError(
            "El proceso pertenece a otro cliente",
        )
    return proceso


def get_template_or_raise(
    db: Session,
    plantilla_id: int,
    current_user: Usuario,
    *,
    allow_inactive: bool = False,
) -> ConfiguracionProceso:
    template_record = db.execute(
        select(ConfiguracionProceso).where(
            ConfiguracionProceso.id == plantilla_id,
        ),
    ).scalar_one_or_none()
    if template_record is None:
        raise TransformacionExcelTemplateNotFoundError(
            "Plantilla no encontrada",
        )

    proceso = template_record.proceso
    if proceso.tipo != TEMPLATE_MODULE:
        raise TransformacionExcelTemplateError(
            "La configuración no pertenece a un proceso TRANSFORMACION_EXCEL",
        )
    if proceso.cliente_id != current_user.cliente_id:
        raise TransformacionExcelTemplateForbiddenError(
            "La plantilla pertenece a otro cliente",
        )
    if not _is_template_config(template_record.config_json):
        raise TransformacionExcelTemplateError(
            "La configuración no es una plantilla TRANSFORMACION_EXCEL",
        )
    if not template_record.activo and not allow_inactive:
        raise TransformacionExcelTemplateError("La plantilla está inactiva")

    parse_template_config_json(template_record.config_json)
    return template_record


def ensure_unique_template_name(
    db: Session,
    proceso_id: int,
    nombre: str,
    *,
    exclude_template_id: int | None = None,
) -> None:
    normalized_name = nombre.strip().casefold()
    records = db.execute(
        select(ConfiguracionProceso).where(
            ConfiguracionProceso.proceso_id == proceso_id,
        ),
    ).scalars()
    for record in records:
        if record.id == exclude_template_id:
            continue
        if not _is_template_config(record.config_json):
            continue
        if record.nombre.strip().casefold() == normalized_name:
            raise TransformacionExcelTemplateConflictError(
                "Ya existe una plantilla con ese nombre para el proceso",
            )


def create_template_from_execution(
    db: Session,
    ejecucion_id: int,
    template_in: TransformacionExcelTemplateCreate,
    current_user: Usuario,
) -> dict[str, Any]:
    ejecucion = get_transformacion_ejecucion_or_raise(
        db,
        ejecucion_id,
        current_user,
    )
    if ejecucion.estado not in TEMPLATE_CREATION_STATES:
        raise TransformacionExcelTemplateError(
            f"No se puede crear una plantilla desde una ejecución "
            f"en estado {ejecucion.estado}",
        )

    try:
        saved = get_saved_transformacion_config(
            db,
            ejecucion_id,
            current_user,
        )
    except ValidationError as exc:
        raise TransformacionExcelTemplateError(
            "La configuración guardada en la ejecución es inválida",
        ) from exc
    template = build_template_from_execution_config(saved["configuracion"])
    ensure_unique_template_name(
        db,
        ejecucion.proceso_id,
        template_in.nombre,
    )

    template_record = ConfiguracionProceso(
        proceso_id=ejecucion.proceso_id,
        nombre=template_in.nombre,
        config_json=serialize_template_config_json(
            template,
            template_in.descripcion,
        ),
        activo=True,
    )
    db.add(template_record)
    db.commit()
    db.refresh(template_record)
    return _build_template_response(template_record)


def list_process_templates(
    db: Session,
    proceso_id: int,
    current_user: Usuario,
    *,
    incluir_inactivas: bool = False,
) -> dict[str, Any]:
    _get_process_or_raise(db, proceso_id, current_user)
    records = db.execute(
        select(ConfiguracionProceso).where(
            ConfiguracionProceso.proceso_id == proceso_id,
        ),
    ).scalars()
    templates = [
        record
        for record in records
        if _is_template_config(record.config_json)
        and (incluir_inactivas or record.activo)
    ]
    templates.sort(key=lambda item: (item.nombre.strip().casefold(), item.id))
    items = [_build_template_response(record) for record in templates]
    return {"items": items, "total": len(items)}


def read_template(
    db: Session,
    plantilla_id: int,
    current_user: Usuario,
) -> dict[str, Any]:
    template_record = get_template_or_raise(
        db,
        plantilla_id,
        current_user,
        allow_inactive=current_user.rol == "ADMIN",
    )
    return _build_template_response(template_record)


def update_template(
    db: Session,
    plantilla_id: int,
    template_in: TransformacionExcelTemplateUpdate,
    current_user: Usuario,
) -> dict[str, Any]:
    template_record = get_template_or_raise(
        db,
        plantilla_id,
        current_user,
        allow_inactive=True,
    )
    fields_set = template_in.model_fields_set
    if "nombre" in fields_set:
        if template_in.nombre is None:
            raise TransformacionExcelTemplateError(
                "nombre no puede ser null",
            )
        ensure_unique_template_name(
            db,
            template_record.proceso_id,
            template_in.nombre,
            exclude_template_id=template_record.id,
        )
        template_record.nombre = template_in.nombre

    current_template = parse_template_config_json(template_record.config_json)
    if "configuracion" in fields_set:
        if template_in.configuracion is None:
            raise TransformacionExcelTemplateError(
                "configuración no puede ser null",
            )
        current_template = template_in.configuracion

    description = _get_template_description(template_record.config_json)
    if "descripcion" in fields_set:
        description = template_in.descripcion
    template_record.config_json = serialize_template_config_json(
        current_template,
        description,
    )

    db.commit()
    db.refresh(template_record)
    return _build_template_response(template_record)


def deactivate_template(
    db: Session,
    plantilla_id: int,
    current_user: Usuario,
) -> None:
    template_record = get_template_or_raise(
        db,
        plantilla_id,
        current_user,
        allow_inactive=True,
    )
    template_record.activo = False
    db.commit()


def apply_template_to_execution(
    db: Session,
    ejecucion_id: int,
    plantilla_id: int,
    archivo_id: int,
    current_user: Usuario,
    *,
    sheet_name: str | None = None,
    header_row: int | None = None,
) -> dict[str, Any]:
    ejecucion = get_transformacion_ejecucion_or_raise(
        db,
        ejecucion_id,
        current_user,
    )
    if ejecucion.estado in TEMPLATE_APPLICATION_BLOCKED_STATES:
        raise TransformacionExcelTemplateError(
            f"No se puede aplicar una plantilla a una ejecución "
            f"en estado {ejecucion.estado}",
        )

    template_record = get_template_or_raise(
        db,
        plantilla_id,
        current_user,
        allow_inactive=True,
    )
    if not template_record.activo:
        raise TransformacionExcelTemplateError("La plantilla está inactiva")
    if template_record.proceso_id != ejecucion.proceso_id:
        raise TransformacionExcelTemplateError(
            "La plantilla no pertenece al mismo proceso que la ejecución",
        )

    template = parse_template_config_json(template_record.config_json)
    config = build_execution_config_from_template(
        template,
        archivo_id,
        sheet_name,
        header_row,
    )
    archivo = get_archivo_or_raise(db, archivo_id)
    validate_source_file_for_execution(archivo, ejecucion_id)
    available_columns = get_available_source_columns(db, config)
    referenced_columns = collect_referenced_source_columns(config)
    validate_referenced_source_columns(referenced_columns, available_columns)

    now = datetime.now(timezone.utc)
    resumen_json = dict(ejecucion.resumen_json or {})
    transformacion_excel = dict(resumen_json.get("transformacion_excel") or {})
    transformacion_excel["configuracion"] = config.model_dump(mode="json")
    transformacion_excel["updated_at"] = now.isoformat()
    transformacion_excel.pop("validacion", None)
    transformacion_excel.pop("generacion", None)
    transformacion_excel["plantilla_aplicada"] = {
        "plantilla_id": template_record.id,
        "nombre": template_record.nombre,
        "schema_version": TEMPLATE_SCHEMA_VERSION,
        "applied_at": now.isoformat(),
    }
    resumen_json["transformacion_excel"] = transformacion_excel

    ejecucion.resumen_json = resumen_json
    ejecucion.estado = "CONFIGURADO"
    ejecucion.error_message = None
    db.commit()
    db.refresh(ejecucion)
    return build_config_response(ejecucion, config, now)
