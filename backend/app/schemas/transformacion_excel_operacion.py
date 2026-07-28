from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TransformacionExcelTraceEventRead(BaseModel):
    event_id: str
    event_type: str
    level: Literal["INFO", "WARNING", "ERROR"]
    occurred_at: datetime
    actor_user_id: int | None = None
    from_state: str | None = None
    to_state: str | None = None
    message: str
    metadata: dict[str, object] = Field(default_factory=dict)


class TransformacionExcelTraceListRead(BaseModel):
    ejecucion_id: int
    items: list[TransformacionExcelTraceEventRead]
    total: int
    limit: int


class TransformacionExcelOperationalIssueRead(BaseModel):
    severity: Literal["ERROR", "WARNING"]
    origin: Literal[
        "VALIDATION",
        "EXECUTION",
        "SOURCE_FILE",
        "OUTPUT_FILE",
        "CONFIGURATION",
        "GENERATION",
    ]
    code: str
    message: str
    blocking: bool
    count: int = Field(default=1, ge=1)
    output_column: str | None = None
    source_column: str | None = None
    sample_rows: list[dict[str, object]] = Field(
        default_factory=list,
        max_length=10,
    )


class TransformacionExcelSourceOperationalRead(BaseModel):
    archivo_id: int
    nombre_original: str
    extension: str | None
    file_exists: bool
    checksum: str | None
    sheet_name: str | None
    header_row: int


class TransformacionExcelTemplateOperationalRead(BaseModel):
    plantilla_id: int
    nombre: str
    schema_version: int
    applied_at: datetime | None


class TransformacionExcelValidationOperationalRead(BaseModel):
    available: bool
    valid: bool | None = None
    validated_at: datetime | None = None
    total_filas_entrada: int | None = None
    filas_validas: int | None = None
    filas_con_errores: int | None = None
    filas_con_advertencias: int | None = None
    duplicados_eliminados: int | None = None


class TransformacionExcelGenerationOperationalRead(BaseModel):
    available: bool
    archivo_id: int | None = None
    nombre_archivo: str | None = None
    file_exists: bool
    total_filas: int | None = None
    columnas_salida: list[str] = Field(default_factory=list)
    size_bytes: int | None = None
    checksum: str | None = None
    generated_at: datetime | None = None


class TransformacionExcelOperationalSummaryRead(BaseModel):
    ejecucion_id: int
    proceso_id: int
    proceso_nombre: str
    estado_ejecucion: str
    action_required: Literal[
        "CONFIGURE",
        "VALIDATE",
        "FIX_ERRORS",
        "GENERATE",
        "WAIT",
        "DOWNLOAD",
        "REGENERATE",
        "REVIEW_ERROR",
        "NONE",
    ]
    can_edit_configuration: bool
    can_validate: bool
    can_generate: bool
    can_download: bool
    has_configuration: bool
    source: TransformacionExcelSourceOperationalRead | None = None
    template: TransformacionExcelTemplateOperationalRead | None = None
    validation: TransformacionExcelValidationOperationalRead
    generation: TransformacionExcelGenerationOperationalRead
    issues: list[TransformacionExcelOperationalIssueRead]
    errors_count: int
    warnings_count: int
    latest_event_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
