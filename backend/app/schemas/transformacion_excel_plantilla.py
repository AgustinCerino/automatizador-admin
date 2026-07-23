from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.transformacion_excel import (
    OutputColumnTransform,
    TransformacionOutputConfig,
    TransformacionRowsConfig,
    normalize_non_empty_string,
    normalize_optional_sheet_name,
    validate_transformacion_structure,
)


class TransformacionExcelTemplateSourceConfig(BaseModel):
    sheet_name: str | None = None
    header_row: int = Field(default=1, gt=0)

    model_config = ConfigDict(extra="forbid")

    @field_validator("sheet_name")
    @classmethod
    def strip_optional_sheet_name(cls, value: str | None) -> str | None:
        return normalize_optional_sheet_name(value)


class TransformacionExcelTemplateConfig(BaseModel):
    source: TransformacionExcelTemplateSourceConfig
    output_columns: list[OutputColumnTransform] = Field(min_length=1)
    rows: TransformacionRowsConfig = Field(default_factory=TransformacionRowsConfig)
    output: TransformacionOutputConfig = Field(
        default_factory=TransformacionOutputConfig,
    )

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_config(self) -> "TransformacionExcelTemplateConfig":
        validate_transformacion_structure(self.output_columns, self.rows)
        return self


class TransformacionExcelTemplateCreate(BaseModel):
    nombre: str = Field(max_length=150)
    descripcion: str | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("nombre")
    @classmethod
    def validate_nombre(cls, value: str) -> str:
        return normalize_non_empty_string(value)

    @field_validator("descripcion")
    @classmethod
    def normalize_descripcion(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        return normalized or None


class TransformacionExcelTemplateUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=150)
    descripcion: str | None = None
    configuracion: TransformacionExcelTemplateConfig | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="before")
    @classmethod
    def require_at_least_one_field(cls, data: object) -> object:
        if isinstance(data, dict) and not {
            "nombre",
            "descripcion",
            "configuracion",
        }.intersection(data):
            raise ValueError("Debe enviar al menos un campo para actualizar")
        return data

    @field_validator("nombre")
    @classmethod
    def validate_nombre(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return normalize_non_empty_string(value)

    @field_validator("descripcion")
    @classmethod
    def normalize_descripcion(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        return normalized or None


class TransformacionExcelTemplateApply(BaseModel):
    archivo_id: int = Field(gt=0)
    sheet_name: str | None = None
    header_row: int | None = Field(default=None, gt=0)

    model_config = ConfigDict(extra="forbid")

    @field_validator("sheet_name")
    @classmethod
    def strip_optional_sheet_name(cls, value: str | None) -> str | None:
        return normalize_optional_sheet_name(value)


class TransformacionExcelTemplateRead(BaseModel):
    id: int
    proceso_id: int
    nombre: str
    descripcion: str | None
    activo: bool
    configuracion: TransformacionExcelTemplateConfig
    schema_version: int
    created_at: datetime | None
    updated_at: datetime | None


class TransformacionExcelTemplateListRead(BaseModel):
    items: list[TransformacionExcelTemplateRead]
    total: int
