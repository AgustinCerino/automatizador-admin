from pydantic import BaseModel


class ConciliacionMappingCreate(BaseModel):
    archivo_a_id: int
    archivo_b_id: int
    columna_clave_archivo_a: str
    columna_clave_archivo_b: str
    columna_importe_archivo_a: str
    columna_importe_archivo_b: str
    tolerancia_importe: float = 0.0
    detectar_duplicados: bool = True


class ConciliacionMappingRead(ConciliacionMappingCreate):
    columnas_archivo_a: list[str]
    columnas_archivo_b: list[str]
