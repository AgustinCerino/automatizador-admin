from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.database.session import get_db
from app.models import Usuario
from app.schemas.transformacion_excel import (
    TransformacionExcelConfig,
    TransformacionExcelConfigRead,
)
from app.schemas.transformacion_excel_inspeccion import (
    TransformacionExcelStructureRead,
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


router = APIRouter(
    prefix="/transformaciones-excel",
    tags=["Transformaciones Excel"],
)


def raise_config_http_error(exc: TransformacionExcelConfigError) -> None:
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
