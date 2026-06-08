from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import Cliente, Proceso
from app.schemas.proceso import ProcesoCreate, ProcesoRead, ProcesoUpdate


router = APIRouter(prefix="/procesos", tags=["procesos"])


def get_proceso_or_404(db: Session, proceso_id: int) -> Proceso:
    proceso = db.get(Proceso, proceso_id)
    if proceso is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proceso no encontrado",
        )
    return proceso


def ensure_cliente_exists(db: Session, cliente_id: int) -> None:
    if db.get(Cliente, cliente_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El cliente indicado no existe",
        )


@router.get("", response_model=list[ProcesoRead])
def list_procesos(
    cliente_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Proceso]:
    statement = select(Proceso).order_by(Proceso.id)
    if cliente_id is not None:
        statement = statement.where(Proceso.cliente_id == cliente_id)

    result = db.execute(statement)
    return list(result.scalars().all())


@router.post("", response_model=ProcesoRead, status_code=status.HTTP_201_CREATED)
def create_proceso(
    proceso_in: ProcesoCreate,
    db: Session = Depends(get_db),
) -> Proceso:
    ensure_cliente_exists(db, proceso_in.cliente_id)

    proceso = Proceso(**proceso_in.model_dump())
    db.add(proceso)
    db.commit()
    db.refresh(proceso)
    return proceso


@router.get("/{proceso_id}", response_model=ProcesoRead)
def read_proceso(proceso_id: int, db: Session = Depends(get_db)) -> Proceso:
    return get_proceso_or_404(db, proceso_id)


@router.patch("/{proceso_id}", response_model=ProcesoRead)
def update_proceso(
    proceso_id: int,
    proceso_in: ProcesoUpdate,
    db: Session = Depends(get_db),
) -> Proceso:
    proceso = get_proceso_or_404(db, proceso_id)
    update_data = proceso_in.model_dump(exclude_unset=True)

    if "cliente_id" in update_data:
        ensure_cliente_exists(db, update_data["cliente_id"])

    for field, value in update_data.items():
        setattr(proceso, field, value)

    db.commit()
    db.refresh(proceso)
    return proceso


@router.delete("/{proceso_id}", response_model=ProcesoRead)
def delete_proceso(proceso_id: int, db: Session = Depends(get_db)) -> Proceso:
    proceso = get_proceso_or_404(db, proceso_id)
    proceso.estado = "INACTIVO"

    db.commit()
    db.refresh(proceso)
    return proceso
