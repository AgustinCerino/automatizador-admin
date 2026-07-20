from datetime import datetime

from pydantic import BaseModel, Field


class TransformacionExcelValidationIssueRead(BaseModel):
    code: str
    message: str
    output_column: str | None = None
    source_column: str | None = None
    count: int
    sample_rows: list[dict[str, object]] = Field(default_factory=list)


class TransformacionExcelValidationRead(BaseModel):
    ejecucion_id: int
    valid: bool
    estado_ejecucion: str
    total_filas_entrada: int
    filas_despues_filtros: int
    filas_excluidas_por_filtros: int
    filas_validas: int
    filas_con_errores: int
    filas_con_advertencias: int
    duplicados_detectados: int
    duplicados_eliminados: int
    columnas_salida: list[str]
    preview_rows: list[dict[str, object]]
    errors: list[TransformacionExcelValidationIssueRead]
    warnings: list[TransformacionExcelValidationIssueRead]
    validated_at: datetime
