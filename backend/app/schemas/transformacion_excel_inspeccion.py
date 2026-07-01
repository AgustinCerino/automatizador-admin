from typing import Any, Literal

from pydantic import BaseModel, Field


class TransformacionExcelColumnInspectionRead(BaseModel):
    name: str
    detected_type: Literal[
        "text",
        "integer",
        "decimal",
        "date",
        "boolean",
        "unknown",
    ]
    null_count: int


class TransformacionExcelInspectionWarningRead(BaseModel):
    code: str
    message: str
    columns: list[str] = Field(default_factory=list)


class TransformacionExcelStructureRead(BaseModel):
    archivo_id: int
    nombre_original: str
    extension: str | None
    available_sheets: list[str]
    selected_sheet_name: str | None
    header_row: int
    columns: list[TransformacionExcelColumnInspectionRead]
    rows: list[dict[str, Any]]
    total_rows: int
    preview_limit: int
    warnings: list[TransformacionExcelInspectionWarningRead] = Field(
        default_factory=list,
    )
