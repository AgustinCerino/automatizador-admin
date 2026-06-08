from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProcesoBase(BaseModel):
    cliente_id: int
    nombre: str
    tipo: str
    descripcion: str | None = None
    estado: str = "ACTIVO"


class ProcesoCreate(ProcesoBase):
    pass


class ProcesoUpdate(BaseModel):
    cliente_id: int | None = None
    nombre: str | None = None
    tipo: str | None = None
    descripcion: str | None = None
    estado: str | None = None


class ProcesoRead(BaseModel):
    id: int
    cliente_id: int
    nombre: str
    tipo: str
    descripcion: str | None
    estado: str
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
