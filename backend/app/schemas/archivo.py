from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ArchivoRead(BaseModel):
    id: int
    ejecucion_id: int
    tipo_archivo: str
    nombre_original: str
    ruta_storage: str
    extension: str | None
    mime_type: str | None
    size_bytes: int | None
    checksum: str | None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)
