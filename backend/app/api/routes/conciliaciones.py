from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user, require_admin
from app.database.session import get_db
from app.models import ResultadoConciliacion, Usuario
from app.schemas.conciliacion_mapping import (
    ConciliacionMappingCreate,
    ConciliacionMappingRead,
)
from app.schemas.resultado_conciliacion import (
    ConciliacionResumenRead,
    ResultadoConciliacionRead,
)
from app.schemas.resultado_revision import (
    RechazarEjecucionRequest,
    ResultadoRevisionUpdate,
    RevisionResumenRead,
)
from app.services.conciliacion_service import (
    execute_reconciliation,
    list_reconciliation_results,
)
from app.services.file_preview_service import FilePreviewError
from app.services.conciliacion_revision_service import (
    ConciliacionRevisionError,
    approve_execution,
    get_revision_summary,
    reject_execution,
    update_resultado_revision,
)
from app.services.conciliacion_export_service import export_reconciliation_results
from app.services.conciliacion_mapping_service import (
    ConciliacionMappingError,
    get_conciliacion_mapping,
    save_conciliacion_mapping,
)


router = APIRouter(prefix="/conciliaciones", tags=["Conciliaciones"])


def raise_mapping_http_error(exc: ConciliacionMappingError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


def raise_revision_http_error(exc: ConciliacionRevisionError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.patch(
    "/resultados/{resultado_id}/revision",
    response_model=ResultadoConciliacionRead,
)
def update_revision(
    resultado_id: int,
    revision_in: ResultadoRevisionUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> ResultadoConciliacion:
    try:
        return update_resultado_revision(db, resultado_id, revision_in)
    except ConciliacionRevisionError as exc:
        raise_revision_http_error(exc)


@router.post(
    "/{ejecucion_id}/mapping",
    response_model=ConciliacionMappingRead,
)
def create_or_replace_mapping(
    ejecucion_id: int,
    mapping_in: ConciliacionMappingCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return save_conciliacion_mapping(db, ejecucion_id, mapping_in)
    except ConciliacionMappingError as exc:
        raise_mapping_http_error(exc)


@router.get(
    "/{ejecucion_id}/mapping",
    response_model=ConciliacionMappingRead,
)
def read_mapping(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return get_conciliacion_mapping(db, ejecucion_id)
    except ConciliacionMappingError as exc:
        raise_mapping_http_error(exc)


@router.post(
    "/{ejecucion_id}/ejecutar",
    response_model=ConciliacionResumenRead,
)
def execute_mapping(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return execute_reconciliation(db, ejecucion_id)
    except ConciliacionMappingError as exc:
        raise_mapping_http_error(exc)
    except FilePreviewError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="No se pudo ejecutar la conciliación",
        ) from exc


@router.get(
    "/{ejecucion_id}/resultados",
    response_model=list[ResultadoConciliacionRead],
)
def read_results(
    ejecucion_id: int,
    estado_resultado: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> list[ResultadoConciliacion]:
    try:
        return list_reconciliation_results(db, ejecucion_id, estado_resultado)
    except ConciliacionMappingError as exc:
        raise_mapping_http_error(exc)


@router.get("/{ejecucion_id}/exportar")
def export_results(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> FileResponse:
    try:
        output_path = export_reconciliation_results(db, ejecucion_id)
    except ConciliacionRevisionError as exc:
        raise_revision_http_error(exc)

    return FileResponse(
        path=output_path,
        filename=output_path.name,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
    )


@router.get(
    "/{ejecucion_id}/revision-resumen",
    response_model=RevisionResumenRead,
)
def read_revision_summary(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> dict:
    try:
        return get_revision_summary(db, ejecucion_id)
    except ConciliacionRevisionError as exc:
        raise_revision_http_error(exc)


@router.post(
    "/{ejecucion_id}/aprobar",
    response_model=RevisionResumenRead,
)
def approve_reconciliation(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
) -> dict:
    try:
        return approve_execution(db, ejecucion_id)
    except ConciliacionRevisionError as exc:
        raise_revision_http_error(exc)


@router.post(
    "/{ejecucion_id}/rechazar",
    response_model=RevisionResumenRead,
)
def reject_reconciliation(
    ejecucion_id: int,
    rechazo_in: RechazarEjecucionRequest | None = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
) -> dict:
    try:
        return reject_execution(
            db,
            ejecucion_id,
            rechazo_in.motivo if rechazo_in is not None else None,
            current_user.id,
        )
    except ConciliacionRevisionError as exc:
        raise_revision_http_error(exc)
