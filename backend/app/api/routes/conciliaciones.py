from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.database.session import get_db
from app.models import Usuario
from app.schemas.conciliacion_mapping import (
    ConciliacionMappingCreate,
    ConciliacionMappingRead,
)
from app.services.conciliacion_mapping_service import (
    ConciliacionMappingError,
    get_conciliacion_mapping,
    save_conciliacion_mapping,
)


router = APIRouter(prefix="/conciliaciones", tags=["Conciliaciones"])


def raise_mapping_http_error(exc: ConciliacionMappingError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


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
