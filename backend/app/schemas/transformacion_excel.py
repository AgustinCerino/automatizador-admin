from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


ScalarValue = str | int | float | bool
OutputType = Literal["text", "integer", "decimal", "date"]


def normalize_non_empty_string(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("El valor no puede estar vacío")
    return normalized


def validate_decimal_places(value: int | None) -> int | None:
    if value is not None and value < 0:
        raise ValueError("decimal_places no puede ser negativo")
    return value


class TransformacionSourceConfig(BaseModel):
    archivo_id: int = Field(gt=0)
    sheet_name: str | None = None
    header_row: int = Field(default=1, gt=0)

    model_config = ConfigDict(extra="forbid")

    @field_validator("sheet_name")
    @classmethod
    def strip_optional_sheet_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        return normalized or None


class SourceOperand(BaseModel):
    type: Literal["SOURCE"]
    value: str

    model_config = ConfigDict(extra="forbid")

    @field_validator("value")
    @classmethod
    def validate_value(cls, value: str) -> str:
        return normalize_non_empty_string(value)


class ConstantOperand(BaseModel):
    type: Literal["CONSTANT"]
    value: int | float

    model_config = ConfigDict(extra="forbid")


ArithmeticOperand = Annotated[
    SourceOperand | ConstantOperand,
    Field(discriminator="type"),
]


class ConcatSourcePart(BaseModel):
    type: Literal["SOURCE"]
    value: str

    model_config = ConfigDict(extra="forbid")

    @field_validator("value")
    @classmethod
    def validate_value(cls, value: str) -> str:
        return normalize_non_empty_string(value)


class ConcatLiteralPart(BaseModel):
    type: Literal["LITERAL"]
    value: str

    model_config = ConfigDict(extra="forbid")


ConcatPart = Annotated[
    ConcatSourcePart | ConcatLiteralPart,
    Field(discriminator="type"),
]


class SourceColumnTransform(BaseModel):
    operation: Literal["SOURCE"]
    position: int = Field(gt=0)
    output_column: str
    source_column: str
    output_type: OutputType
    date_format: str | None = None
    decimal_places: int | None = None
    required: bool = False

    model_config = ConfigDict(extra="forbid")

    @field_validator("output_column", "source_column")
    @classmethod
    def validate_columns(cls, value: str) -> str:
        return normalize_non_empty_string(value)

    @field_validator("decimal_places")
    @classmethod
    def validate_decimal_places(cls, value: int | None) -> int | None:
        return validate_decimal_places(value)


class ConstantColumnTransform(BaseModel):
    operation: Literal["CONSTANT"]
    position: int = Field(gt=0)
    output_column: str
    value: str | int | float | bool | None
    output_type: OutputType
    date_format: str | None = None
    decimal_places: int | None = None
    required: bool = False

    model_config = ConfigDict(extra="forbid")

    @field_validator("output_column")
    @classmethod
    def validate_output_column(cls, value: str) -> str:
        return normalize_non_empty_string(value)

    @field_validator("decimal_places")
    @classmethod
    def validate_decimal_places(cls, value: int | None) -> int | None:
        return validate_decimal_places(value)


class ConcatColumnTransform(BaseModel):
    operation: Literal["CONCAT"]
    position: int = Field(gt=0)
    output_column: str
    parts: list[ConcatPart] = Field(min_length=1)
    output_type: Literal["text"] = "text"
    required: bool = False

    model_config = ConfigDict(extra="forbid")

    @field_validator("output_column")
    @classmethod
    def validate_output_column(cls, value: str) -> str:
        return normalize_non_empty_string(value)


class ArithmeticColumnTransform(BaseModel):
    operation: Literal["ARITHMETIC"]
    position: int = Field(gt=0)
    output_column: str
    operator: Literal["ADD", "SUBTRACT", "MULTIPLY", "DIVIDE"]
    left_operand: ArithmeticOperand
    right_operand: ArithmeticOperand
    output_type: Literal["decimal", "integer"] = "decimal"
    decimal_places: int = Field(default=2, ge=0)
    required: bool = False

    model_config = ConfigDict(extra="forbid")

    @field_validator("output_column")
    @classmethod
    def validate_output_column(cls, value: str) -> str:
        return normalize_non_empty_string(value)


class ValueMapColumnTransform(BaseModel):
    operation: Literal["VALUE_MAP"]
    position: int = Field(gt=0)
    output_column: str
    source_column: str
    mapping: dict[str, ScalarValue] = Field(min_length=1)
    unmapped_policy: Literal["ERROR", "KEEP_ORIGINAL", "USE_DEFAULT"]
    default_value: str | int | float | bool | None = None
    output_type: OutputType
    date_format: str | None = None
    decimal_places: int | None = None
    required: bool = False

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="before")
    @classmethod
    def validate_default_value_presence(cls, data: object) -> object:
        if (
            isinstance(data, dict)
            and data.get("unmapped_policy") == "USE_DEFAULT"
            and "default_value" not in data
        ):
            raise ValueError(
                "default_value es requerido cuando unmapped_policy es USE_DEFAULT",
            )
        return data

    @field_validator("output_column", "source_column")
    @classmethod
    def validate_columns(cls, value: str) -> str:
        return normalize_non_empty_string(value)

    @field_validator("decimal_places")
    @classmethod
    def validate_decimal_places(cls, value: int | None) -> int | None:
        return validate_decimal_places(value)


OutputColumnTransform = Annotated[
    SourceColumnTransform
    | ConstantColumnTransform
    | ConcatColumnTransform
    | ArithmeticColumnTransform
    | ValueMapColumnTransform,
    Field(discriminator="operation"),
]


class TransformacionFilterRule(BaseModel):
    source_column: str
    operator: Literal[
        "EQUALS",
        "IN",
        "NOT_EMPTY",
        "IS_EMPTY",
        "GREATER_THAN",
        "LESS_THAN",
        "CONTAINS",
    ]
    value: str | int | float | bool | None = None
    values: list[ScalarValue] | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("source_column")
    @classmethod
    def validate_source_column(cls, value: str) -> str:
        return normalize_non_empty_string(value)

    @model_validator(mode="after")
    def validate_operator_values(self) -> "TransformacionFilterRule":
        if self.operator == "IN" and not self.values:
            raise ValueError("IN requiere values con al menos un elemento")
        if self.operator in {
            "EQUALS",
            "GREATER_THAN",
            "LESS_THAN",
            "CONTAINS",
        } and self.value is None:
            raise ValueError(f"{self.operator} requiere value")
        return self


class RemoveDuplicatesConfig(BaseModel):
    enabled: bool = False
    by_output_columns: list[str] = Field(default_factory=list)
    keep: Literal["FIRST"] = "FIRST"

    model_config = ConfigDict(extra="forbid")

    @field_validator("by_output_columns")
    @classmethod
    def validate_by_output_columns(cls, value: list[str]) -> list[str]:
        return [normalize_non_empty_string(column) for column in value]

    @model_validator(mode="after")
    def validate_enabled_columns(self) -> "RemoveDuplicatesConfig":
        if self.enabled and not self.by_output_columns:
            raise ValueError(
                "remove_duplicates habilitado requiere al menos una columna",
            )
        return self


class SortRule(BaseModel):
    output_column: str
    direction: Literal["ASC", "DESC"] = "ASC"

    model_config = ConfigDict(extra="forbid")

    @field_validator("output_column")
    @classmethod
    def validate_output_column(cls, value: str) -> str:
        return normalize_non_empty_string(value)


class TransformacionRowsConfig(BaseModel):
    filters: list[TransformacionFilterRule] = Field(
        default_factory=list,
        max_length=5,
    )
    remove_duplicates: RemoveDuplicatesConfig = Field(
        default_factory=RemoveDuplicatesConfig,
    )
    sort_by: list[SortRule] = Field(default_factory=list, max_length=3)

    model_config = ConfigDict(extra="forbid")


class TransformacionOutputConfig(BaseModel):
    file_name: str = "transformacion.xlsx"
    sheet_name: str = "Resultado"
    freeze_header: bool = True
    auto_filter: bool = True
    auto_width: bool = True

    model_config = ConfigDict(extra="forbid")

    @field_validator("file_name")
    @classmethod
    def validate_file_name(cls, value: str) -> str:
        file_name = normalize_non_empty_string(value)
        if not file_name.lower().endswith(".xlsx"):
            raise ValueError("file_name debe terminar en .xlsx")
        return file_name

    @field_validator("sheet_name")
    @classmethod
    def validate_sheet_name(cls, value: str) -> str:
        return normalize_non_empty_string(value)


class TransformacionExcelConfig(BaseModel):
    source: TransformacionSourceConfig
    output_columns: list[OutputColumnTransform] = Field(min_length=1)
    rows: TransformacionRowsConfig = Field(default_factory=TransformacionRowsConfig)
    output: TransformacionOutputConfig = Field(
        default_factory=TransformacionOutputConfig,
    )

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_config(self) -> "TransformacionExcelConfig":
        normalized_output_columns = [
            column.output_column.strip().lower()
            for column in self.output_columns
        ]
        if len(normalized_output_columns) != len(set(normalized_output_columns)):
            raise ValueError("Los nombres de columnas de salida deben ser únicos")

        positions = [column.position for column in self.output_columns]
        if len(positions) != len(set(positions)):
            raise ValueError("Las posiciones de columnas de salida deben ser únicas")

        available_columns = set(normalized_output_columns)
        duplicate_columns = {
            column.strip().lower()
            for column in self.rows.remove_duplicates.by_output_columns
        }
        missing_duplicate_columns = duplicate_columns - available_columns
        if missing_duplicate_columns:
            missing = ", ".join(sorted(missing_duplicate_columns))
            raise ValueError(
                "Columnas de remove_duplicates inexistentes en output_columns: "
                f"{missing}",
            )

        sort_columns = {
            rule.output_column.strip().lower()
            for rule in self.rows.sort_by
        }
        missing_sort_columns = sort_columns - available_columns
        if missing_sort_columns:
            missing = ", ".join(sorted(missing_sort_columns))
            raise ValueError(
                "Columnas de sort_by inexistentes en output_columns: "
                f"{missing}",
            )

        return self


class TransformacionExcelConfigRead(BaseModel):
    ejecucion_id: int
    estado_ejecucion: str
    configuracion: TransformacionExcelConfig
    updated_at: datetime | None


TransformacionExcelConfigSaveResponse = TransformacionExcelConfigRead
