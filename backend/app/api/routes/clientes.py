from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import Cliente
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
def list_clientes(db: Session = Depends(get_db)) -> list[Cliente]:
    result = db.execute(select(Cliente).order_by(Cliente.id))
    return list(result.scalars().all())


@router.post("", response_model=ClienteRead, status_code=status.HTTP_201_CREATED)
def create_cliente(
    cliente_in: ClienteCreate,
    db: Session = Depends(get_db),
) -> Cliente:
    cliente = Cliente(**cliente_in.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


@router.get("/{cliente_id}", response_model=ClienteRead)
def read_cliente(cliente_id: int, db: Session = Depends(get_db)) -> Cliente:
    return get_cliente_or_404(db, cliente_id)


@router.patch("/{cliente_id}", response_model=ClienteRead)
def update_cliente(
    cliente_id: int,
    cliente_in: ClienteUpdate,
    db: Session = Depends(get_db),
) -> Cliente:
    cliente = get_cliente_or_404(db, cliente_id)
    update_data = cliente_in.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(cliente, field, value)

    db.commit()
    db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", response_model=ClienteRead)
def delete_cliente(cliente_id: int, db: Session = Depends(get_db)) -> Cliente:
    cliente = get_cliente_or_404(db, cliente_id)
    cliente.estado = "INACTIVO"

    db.commit()
    db.refresh(cliente)
    return cliente
