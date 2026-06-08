from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ClienteBase(BaseModel):
    nombre: str
    cuit: str | None = None
    estado: str = "ACTIVO"


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nombre: str | None = None
    cuit: str | None = None
    estado: str | None = None


class ClienteRead(BaseModel):
    id: int
    nombre: str
    cuit: str | None
    estado: str
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
