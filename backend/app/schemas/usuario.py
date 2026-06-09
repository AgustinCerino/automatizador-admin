from pydantic import BaseModel, ConfigDict


class UsuarioRead(BaseModel):
    id: int
    cliente_id: int
    nombre: str
    email: str
    rol: str
    estado: str

    model_config = ConfigDict(from_attributes=True)
