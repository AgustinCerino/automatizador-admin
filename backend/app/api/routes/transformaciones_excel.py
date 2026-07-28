from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user, require_admin
from app.database.session import get_db
from app.models import Usuario
from app.schemas.transformacion_excel import (
    TransformacionExcelConfig,
    TransformacionExcelConfigRead,
)
from app.schemas.transformacion_excel_inspeccion import (
    TransformacionExcelStructureRead,
)
from app.schemas.transformacion_excel_generacion import (
    TransformacionExcelGenerationRead,
)
from app.schemas.transformacion_excel_operacion import (
    TransformacionExcelOperationalSummaryRead,
    TransformacionExcelTraceListRead,
)
from app.schemas.transformacion_excel_plantilla import (
    TransformacionExcelTemplateApply,
    TransformacionExcelTemplateCreate,
    TransformacionExcelTemplateListRead,
    TransformacionExcelTemplateRead,
    TransformacionExcelTemplateUpdate,
)
from app.schemas.transformacion_excel_validacion import (
    TransformacionExcelValidationRead,
)
from app.services.transformacion_excel_config_service import (
    TransformacionExcelConfigError,
    get_saved_transformacion_config,
    save_transformacion_config,
)
from app.services.transformacion_excel_inspeccion_service import (
    TransformacionExcelInspeccionError,
    build_transformacion_excel_structure,
)
from app.services.transformacion_excel_generation_service import (
    TransformacionExcelGenerationError,
    TransformacionExcelGenerationTechnicalError,
    generate_transformacion_result,
    get_transformacion_result,
    get_transformacion_result_download,
)
from app.services.transformacion_excel_validation_service import (
    TransformacionExcelValidationTechnicalError,
    validate_transformacion_execution,
)
from app.services.transformacion_excel_template_service import (
    TransformacionExcelTemplateError,
    apply_template_to_execution,
    create_template_from_execution,
    deactivate_template,
    list_process_templates,
    read_template,
    update_template,
)
from app.services.transformacion_excel_operational_service import (
    get_transformacion_operational_summary,
    get_transformacion_trace_list,
)


router = APIRouter(
    prefix="/transformaciones-excel",
    tags=["Transformaciones Excel"],
)


def raise_config_http_error(exc: TransformacionExcelConfigError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


def raise_generation_http_error(
    exc: TransformacionExcelGenerationError,
) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


def raise_template_http_error(
    exc: TransformacionExcelTemplateError,
) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get(
    "/archivos/{archivo_id}/estructura",
    response_model=TransformacionExcelStructureRead,
)
def inspect_archivo_structure(
    archivo_id: int,
    sheet_name: str | None = Query(default=None),
    header_row: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return build_transformacion_excel_structure(
            db=db,
            archivo_id=archivo_id,
            sheet_name=sheet_name,
            header_row=header_row,
            limit=limit,
        )
    except TransformacionExcelInspeccionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get(
    "/procesos/{proceso_id}/plantillas",
    response_model=TransformacionExcelTemplateListRead,
)
def list_transformacion_templates(
    proceso_id: int,
    incluir_inactivas: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return list_process_templates(
            db,
            proceso_id,
            current_user,
            incluir_inactivas=incluir_inactivas,
        )
    except TransformacionExcelTemplateError as exc:
        raise_template_http_error(exc)


@router.get(
    "/plantillas/{plantilla_id}",
    response_model=TransformacionExcelTemplateRead,
)
def read_transformacion_template(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return read_template(db, plantilla_id, current_user)
    except TransformacionExcelTemplateError as exc:
        raise_template_http_error(exc)


@router.put(
    "/plantillas/{plantilla_id}",
    response_model=TransformacionExcelTemplateRead,
)
def update_transformacion_template(
    plantilla_id: int,
    template_in: TransformacionExcelTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
) -> dict:
    try:
        return update_template(db, plantilla_id, template_in, current_user)
    except TransformacionExcelTemplateError as exc:
        raise_template_http_error(exc)


@router.delete(
    "/plantillas/{plantilla_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def deactivate_transformacion_template(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
) -> Response:
    try:
        deactivate_template(db, plantilla_id, current_user)
    except TransformacionExcelTemplateError as exc:
        raise_template_http_error(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{ejecucion_id}/plantillas",
    response_model=TransformacionExcelTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
def create_transformacion_template(
    ejecucion_id: int,
    template_in: TransformacionExcelTemplateCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
) -> dict:
    try:
        return create_template_from_execution(
            db,
            ejecucion_id,
            template_in,
            current_user,
        )
    except (TransformacionExcelTemplateError, TransformacionExcelConfigError) as exc:
        if isinstance(exc, TransformacionExcelTemplateError):
            raise_template_http_error(exc)
        raise_config_http_error(exc)


@router.post(
    "/{ejecucion_id}/plantillas/{plantilla_id}/aplicar",
    response_model=TransformacionExcelConfigRead,
)
def apply_transformacion_template(
    ejecucion_id: int,
    plantilla_id: int,
    apply_in: TransformacionExcelTemplateApply,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return apply_template_to_execution(
            db,
            ejecucion_id,
            plantilla_id,
            apply_in.archivo_id,
            current_user,
            sheet_name=apply_in.sheet_name,
            header_row=apply_in.header_row,
        )
    except TransformacionExcelTemplateError as exc:
        raise_template_http_error(exc)
    except TransformacionExcelConfigError as exc:
        raise_config_http_error(exc)


@router.get(
    "/{ejecucion_id}/resumen",
    response_model=TransformacionExcelOperationalSummaryRead,
)
def read_transformacion_operational_summary(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> TransformacionExcelOperationalSummaryRead:
    try:
        return get_transformacion_operational_summary(
            db,
            ejecucion_id,
            current_user,
        )
    except TransformacionExcelConfigError as exc:
        raise_config_http_error(exc)


@router.get(
    "/{ejecucion_id}/trazabilidad",
    response_model=TransformacionExcelTraceListRead,
)
def read_transformacion_trace(
    ejecucion_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return get_transformacion_trace_list(
            db,
            ejecucion_id,
            current_user,
            limit,
        )
    except TransformacionExcelConfigError as exc:
        raise_config_http_error(exc)


@router.post(
    "/{ejecucion_id}/configuracion",
    response_model=TransformacionExcelConfigRead,
)
def save_configuracion_transformacion(
    ejecucion_id: int,
    config: TransformacionExcelConfig,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return save_transformacion_config(db, ejecucion_id, config, current_user)
    except TransformacionExcelConfigError as exc:
        raise_config_http_error(exc)


@router.get(
    "/{ejecucion_id}/configuracion",
    response_model=TransformacionExcelConfigRead,
)
def read_configuracion_transformacion(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return get_saved_transformacion_config(db, ejecucion_id, current_user)
    except TransformacionExcelConfigError as exc:
        raise_config_http_error(exc)


@router.post(
    "/{ejecucion_id}/validar",
    response_model=TransformacionExcelValidationRead,
)
def validate_configured_transformacion(
    ejecucion_id: int,
    preview_limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return validate_transformacion_execution(
            db,
            ejecucion_id,
            current_user,
            preview_limit,
        )
    except TransformacionExcelConfigError as exc:
        raise_config_http_error(exc)
    except TransformacionExcelValidationTechnicalError as exc:
        raise HTTPException(
            status_code=500,
            detail="No se pudo validar la transformación.",
        ) from exc


@router.post(
    "/{ejecucion_id}/generar",
    response_model=TransformacionExcelGenerationRead,
)
def generate_configured_transformacion(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return generate_transformacion_result(
            db,
            ejecucion_id,
            current_user,
        )
    except TransformacionExcelConfigError as exc:
        raise_config_http_error(exc)
    except TransformacionExcelGenerationError as exc:
        raise_generation_http_error(exc)
    except TransformacionExcelGenerationTechnicalError as exc:
        raise HTTPException(
            status_code=500,
            detail="No se pudo generar la transformación.",
        ) from exc


@router.get(
    "/{ejecucion_id}/resultado",
    response_model=TransformacionExcelGenerationRead,
)
def read_transformacion_result(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return get_transformacion_result(
            db,
            ejecucion_id,
            current_user,
        )
    except TransformacionExcelConfigError as exc:
        raise_config_http_error(exc)
    except TransformacionExcelGenerationError as exc:
        raise_generation_http_error(exc)


@router.get("/{ejecucion_id}/resultado/descargar")
def download_transformacion_result(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> FileResponse:
    try:
        download = get_transformacion_result_download(
            db,
            ejecucion_id,
            current_user,
        )
    except TransformacionExcelConfigError as exc:
        raise_config_http_error(exc)
    except TransformacionExcelGenerationError as exc:
        raise_generation_http_error(exc)

    return FileResponse(
        path=download.path,
        filename=download.filename,
        media_type=download.media_type,
    )
