from datetime import datetime

from pydantic import BaseModel


class TransformacionExcelGenerationRead(BaseModel):
    ejecucion_id: int
    estado_ejecucion: str
    archivo_id: int
    nombre_archivo: str
    extension: str
    mime_type: str
    size_bytes: int
    checksum: str
    total_filas: int
    columnas_salida: list[str]
    generated_at: datetime
    reused: bool = False
