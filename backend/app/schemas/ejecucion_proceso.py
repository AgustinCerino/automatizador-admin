from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EjecucionProcesoCreate(BaseModel):
    proceso_id: int


class EjecucionProcesoUpdate(BaseModel):
    estado: str | None = None
    resumen_json: dict | None = None
    error_message: str | None = None
    finished_at: datetime | None = None


class EjecucionProcesoRead(BaseModel):
    id: int
    proceso_id: int
    usuario_id: int
    estado: str
    resumen_json: dict | None
    error_message: str | None
    started_at: datetime
    finished_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
