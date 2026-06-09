from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user, require_admin
from app.database.session import get_db
from app.models import Cliente, Usuario
from app.schemas.cliente import ClienteCreate, ClienteRead, ClienteUpdate


router = APIRouter(prefix="/clientes", tags=["clientes"])


def get_cliente_or_404(db: Session, cliente_id: int) -> Cliente:
    cliente = db.get(Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )
    return cliente


@router.get("", response_model=list[ClienteRead])
def list_clientes(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> list[Cliente]:
    result = db.execute(select(Cliente).order_by(Cliente.id))
    return list(result.scalars().all())


@router.post("", response_model=ClienteRead, status_code=status.HTTP_201_CREATED)
def create_cliente(
    cliente_in: ClienteCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
) -> Cliente:
    cliente = Cliente(**cliente_in.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.get("/{cliente_id}", response_model=ClienteRead)
def read_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> Cliente:
    return get_cliente_or_404(db, cliente_id)


@router.patch("/{cliente_id}", response_model=ClienteRead)
def update_cliente(
    cliente_id: int,
    cliente_in: ClienteUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
) -> Cliente:
    cliente = get_cliente_or_404(db, cliente_id)
    update_data = cliente_in.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(cliente, field, value)

    db.commit()
    db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", response_model=ClienteRead)
def delete_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin),
) -> Cliente:
    cliente = get_cliente_or_404(db, cliente_id)
    cliente.estado = "INACTIVO"

    db.commit()
    db.refresh(cliente)
    return cliente
