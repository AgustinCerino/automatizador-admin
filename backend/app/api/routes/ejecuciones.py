from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user, require_admin
from app.database.session import get_db
from app.models import EjecucionProceso, Proceso, Usuario
from app.schemas.ejecucion_proceso import (
    EjecucionProcesoCreate,
    EjecucionProcesoRead,
    EjecucionProcesoUpdate,
)


router = APIRouter(prefix="/ejecuciones", tags=["ejecuciones"])


def get_ejecucion_or_404(db: Session, ejecucion_id: int) -> EjecucionProceso:
    ejecucion = db.get(EjecucionProceso, ejecucion_id)
    if ejecucion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejecución no encontrada",
        )
    return ejecucion


def ensure_proceso_exists(db: Session, proceso_id: int) -> None:
    if db.get(Proceso, proceso_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El proceso indicado no existe",
        )


@router.get("", response_model=list[EjecucionProcesoRead])
def list_ejecuciones(
    proceso_id: int | None = Query(default=None),
    estado: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> list[EjecucionProceso]:
    statement = select(EjecucionProceso).order_by(EjecucionProceso.id)

    if proceso_id is not None:
        statement = statement.where(EjecucionProceso.proceso_id == proceso_id)
    if estado is not None:
        statement = statement.where(EjecucionProceso.estado == estado)

    result = db.execute(statement)
    return list(result.scalars().all())


@router.post(
    "",
    response_model=EjecucionProcesoRead,
    status_code=status.HTTP_201_CREATED,
)
def create_ejecucion(
    ejecucion_in: EjecucionProcesoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> EjecucionProceso:
    ensure_proceso_exists(db, ejecucion_in.proceso_id)

    ejecucion = EjecucionProceso(
        proceso_id=ejecucion_in.proceso_id,
        usuario_id=current_user.id,
        estado="CARGADO",
    )
    db.add(ejecucion)
    db.commit()
    db.refresh(ejecucion)
    return ejecucion


@router.get("/{ejecucion_id}", response_model=EjecucionProcesoRead)
def read_ejecucion(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> EjecucionProceso:
    return get_ejecucion_or_404(db, ejecucion_id)


@router.patch("/{ejecucion_id}", response_model=EjecucionProcesoRead)
def update_ejecucion(
    ejecucion_id: int,
    ejecucion_in: EjecucionProcesoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
) -> EjecucionProceso:
    ejecucion = get_ejecucion_or_404(db, ejecucion_id)
    update_data = ejecucion_in.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(ejecucion, field, value)

    db.commit()
    db.refresh(ejecucion)
    return ejecucion


@router.delete("/{ejecucion_id}", response_model=EjecucionProcesoRead)
def delete_ejecucion(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
) -> EjecucionProceso:
    ejecucion = get_ejecucion_or_404(db, ejecucion_id)
    ejecucion.estado = "CANCELADO"

    db.commit()
    db.refresh(ejecucion)
    return ejecucion
