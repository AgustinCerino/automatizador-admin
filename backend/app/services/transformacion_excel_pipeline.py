from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import math
import re
from typing import Any, Literal

import pandas as pd

from app.models import Archivo
from app.schemas.transformacion_excel import (
    ArithmeticColumnTransform,
    OutputColumnTransform,
    SourceColumnTransform,
    TransformacionExcelConfig,
    TransformacionFilterRule,
    TransformacionSourceConfig,
    ValueMapColumnTransform,
)
from app.services.transformacion_excel_inspeccion_service import (
    get_available_sheets,
    get_raw_headers,
    normalize_column_name,
    normalize_extension,
    read_source_dataframe,
    resolve_existing_storage_path,
    select_sheet_name,
    validate_headers,
)


SOURCE_ROW_NUMBER = "__source_row_number__"
MAX_ISSUE_SAMPLES = 10
IssueSeverity = Literal["error", "warning"]

ISSUE_MESSAGES = {
    "INVALID_FILTER_VALUE": (
        "El valor no pudo convertirse para evaluar el filtro numérico."
    ),
    "REQUIRED_VALUE_MISSING": "El valor requerido está vacío.",
    "INVALID_DECIMAL": "El valor no es un decimal válido.",
    "INVALID_INTEGER": "El valor no es un entero válido.",
    "INVALID_DATE": "El valor no es una fecha válida.",
    "INVALID_NUMERIC_OPERAND": "El operando no es numérico.",
    "INVALID_INTEGER_RESULT": "El resultado aritmético no es entero.",
    "DIVISION_BY_ZERO": "No se puede dividir por cero.",
    "UNMAPPED_VALUE": "El valor no está incluido en el mapa configurado.",
    "UNMAPPED_VALUE_KEPT": (
        "El valor no está mapeado y se conservó el original."
    ),
    "UNMAPPED_VALUE_DEFAULTED": (
        "El valor no está mapeado y se utilizó el valor por defecto."
    ),
    "DUPLICATES_REMOVED": (
        "La fila sería eliminada por la configuración de duplicados."
    ),
    "ROWS_FILTERED_OUT": "La fila fue excluida por los filtros configurados.",
}

_VALUE_NOT_PROVIDED = object()


@dataclass
class _IssueGroup:
    code: str
    message: str
    output_column: str | None
    source_column: str | None
    row_numbers: set[int] = field(default_factory=set)
    samples: list[dict[str, object]] = field(default_factory=list)

    def add(self, source_row_number: int, value: Any) -> None:
        if source_row_number in self.row_numbers:
            return

        self.row_numbers.add(source_row_number)
        if len(self.samples) >= MAX_ISSUE_SAMPLES:
            return

        sample: dict[str, object] = {
            "source_row_number": source_row_number,
        }
        if value is not _VALUE_NOT_PROVIDED:
            sample["value"] = serialize_json_value(value)
        self.samples.append(sample)

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "output_column": self.output_column,
            "source_column": self.source_column,
            "count": len(self.row_numbers),
            "sample_rows": self.samples,
        }


class ValidationIssueCollector:
    def __init__(self) -> None:
        self._groups: dict[
            tuple[IssueSeverity, str, str | None, str | None],
            _IssueGroup,
        ] = {}
        self.error_rows: set[int] = set()
        self.warning_rows: set[int] = set()

    def add(
        self,
        severity: IssueSeverity,
        code: str,
        source_row_number: int,
        *,
        output_column: str | None = None,
        source_column: str | None = None,
        value: Any = _VALUE_NOT_PROVIDED,
    ) -> None:
        key = (severity, code, output_column, source_column)
        group = self._groups.setdefault(
            key,
            _IssueGroup(
                code=code,
                message=ISSUE_MESSAGES[code],
                output_column=output_column,
                source_column=source_column,
            ),
        )
        group.add(source_row_number, value)

        if severity == "error":
            self.error_rows.add(source_row_number)
        else:
            self.warning_rows.add(source_row_number)

    def build(self, severity: IssueSeverity) -> list[dict[str, Any]]:
        return [
            group.to_dict()
            for key, group in self._groups.items()
            if key[0] == severity
        ]


def is_missing(value: Any) -> bool:
    if value is None:
        return True
    try:
        missing = pd.isna(value)
    except (TypeError, ValueError):
        return False
    return bool(missing) if isinstance(missing, bool) else False


def normalize_text(value: Any) -> str | None:
    if is_missing(value):
        return None
    normalized = str(value).strip()
    return normalized or None


def normalize_comparison_text(value: Any) -> str:
    normalized = normalize_text(value)
    return "" if normalized is None else normalized.casefold()


def parse_decimal(value: Any) -> Decimal | None:
    if is_missing(value) or isinstance(value, bool):
        return None

    if isinstance(value, Decimal):
        return value if value.is_finite() else None

    if isinstance(value, int):
        return Decimal(value)

    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        return Decimal(str(value))

    text = str(value).strip().replace(" ", "")
    if not text:
        return None

    if "," in text and "." in text:
        return None
    if text.count(",") > 1 or text.count(".") > 1:
        return None
    if "," in text:
        text = text.replace(",", ".")

    try:
        parsed = Decimal(text)
    except (InvalidOperation, ValueError):
        return None
    return parsed if parsed.is_finite() else None


def parse_date(value: Any, date_format: str | None) -> date | None:
    if is_missing(value) or isinstance(value, (bool, int, float, Decimal)):
        return None

    if isinstance(value, pd.Timestamp):
        return value.date()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    if not text:
        return None
    if re.fullmatch(r"[-+]?\d+(?:[.,]\d+)?", text):
        return None

    formats = [
        date_format,
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
    ]
    for candidate_format in formats:
        if not candidate_format:
            continue
        try:
            return datetime.strptime(text, candidate_format).date()
        except ValueError:
            continue

    try:
        return datetime.fromisoformat(text).date()
    except ValueError:
        return None


def convert_output_value(
    value: Any,
    output_type: str,
    date_format: str | None = None,
) -> tuple[Any, str | None]:
    if is_missing(value):
        return None, None

    if output_type == "text":
        return normalize_text(value), None

    if output_type == "decimal":
        parsed_decimal = parse_decimal(value)
        if parsed_decimal is None:
            return None, "INVALID_DECIMAL"
        return parsed_decimal, None

    if output_type == "integer":
        parsed_integer = parse_decimal(value)
        if (
            parsed_integer is None
            or parsed_integer != parsed_integer.to_integral_value()
        ):
            return None, "INVALID_INTEGER"
        return int(parsed_integer), None

    if output_type == "date":
        parsed_date = parse_date(value, date_format)
        if parsed_date is None:
            return None, "INVALID_DATE"
        return parsed_date, None

    raise ValueError(f"Tipo de salida no soportado: {output_type}")


def apply_configured_decimal_places(
    value: Any,
    transform: OutputColumnTransform,
) -> Any:
    decimal_places = getattr(transform, "decimal_places", None)
    if (
        isinstance(value, Decimal)
        and transform.output_type == "decimal"
        and decimal_places is not None
    ):
        quantum = Decimal(1).scaleb(-decimal_places)
        return value.quantize(quantum, rounding=ROUND_HALF_UP)
    return value


def serialize_json_value(value: Any) -> Any:
    if is_missing(value):
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date, pd.Timestamp)):
        return value.isoformat()
    if isinstance(value, dict):
        return {
            str(key): serialize_json_value(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [serialize_json_value(item) for item in value]
    if hasattr(value, "item"):
        return serialize_json_value(value.item())
    return value


def read_configured_source_dataframe(
    archivo: Archivo,
    source: TransformacionSourceConfig,
) -> pd.DataFrame:
    extension = normalize_extension(archivo.extension)
    path = resolve_existing_storage_path(archivo)
    available_sheets = get_available_sheets(path, extension)
    selected_sheet_name = select_sheet_name(
        extension,
        available_sheets,
        source.sheet_name,
    )
    raw_headers = get_raw_headers(
        path,
        extension,
        selected_sheet_name,
        source.header_row,
    )
    dataframe = read_source_dataframe(
        path,
        extension,
        selected_sheet_name,
        source.header_row,
    )

    if len(raw_headers) == len(dataframe.columns):
        dataframe.columns = raw_headers

    column_names = [
        normalize_column_name(column)
        for column in dataframe.columns
    ]
    validate_headers(column_names)
    dataframe.columns = column_names
    return dataframe.reset_index(drop=True)


def evaluate_filter(
    value: Any,
    rule: TransformacionFilterRule,
) -> tuple[bool, bool]:
    if rule.operator == "NOT_EMPTY":
        return not is_missing_or_empty(value), False
    if rule.operator == "IS_EMPTY":
        return is_missing_or_empty(value), False
    if rule.operator == "EQUALS":
        return (
            normalize_comparison_text(value)
            == normalize_comparison_text(rule.value)
        ), False
    if rule.operator == "IN":
        allowed_values = {
            normalize_comparison_text(item)
            for item in (rule.values or [])
        }
        return normalize_comparison_text(value) in allowed_values, False
    if rule.operator == "CONTAINS":
        expected = normalize_comparison_text(rule.value)
        return expected in normalize_comparison_text(value), False
    if rule.operator in {"GREATER_THAN", "LESS_THAN"}:
        current_number = parse_decimal(value)
        expected_number = parse_decimal(rule.value)
        if current_number is None or expected_number is None:
            return False, True
        if rule.operator == "GREATER_THAN":
            return current_number > expected_number, False
        return current_number < expected_number, False

    raise ValueError(f"Operador de filtro no soportado: {rule.operator}")


def is_missing_or_empty(value: Any) -> bool:
    return normalize_text(value) is None


def apply_filters(
    dataframe: pd.DataFrame,
    config: TransformacionExcelConfig,
    collector: ValidationIssueCollector,
) -> pd.DataFrame:
    if not config.rows.filters:
        return dataframe.copy()

    passed_by_index = {index: True for index in dataframe.index}
    filter_error_indices: set[int] = set()

    for rule in config.rows.filters:
        for index, value in dataframe[rule.source_column].items():
            matches, has_error = evaluate_filter(value, rule)
            source_row_number = int(dataframe.at[index, SOURCE_ROW_NUMBER])
            if has_error:
                filter_error_indices.add(index)
                collector.add(
                    "error",
                    "INVALID_FILTER_VALUE",
                    source_row_number,
                    source_column=rule.source_column,
                    value=value,
                )
                passed_by_index[index] = False
                continue
            passed_by_index[index] = passed_by_index[index] and matches

    passed_indices = [
        index
        for index in dataframe.index
        if passed_by_index[index] and index not in filter_error_indices
    ]
    for index in dataframe.index:
        if index in passed_indices or index in filter_error_indices:
            continue
        collector.add(
            "warning",
            "ROWS_FILTERED_OUT",
            int(dataframe.at[index, SOURCE_ROW_NUMBER]),
        )

    return dataframe.loc[passed_indices].copy()


def source_column_for_transform(
    transform: OutputColumnTransform,
) -> str | None:
    if isinstance(transform, (SourceColumnTransform, ValueMapColumnTransform)):
        return transform.source_column
    return None


def add_conversion_or_required_issue(
    collector: ValidationIssueCollector,
    transform: OutputColumnTransform,
    source_row_number: int,
    raw_value: Any,
    converted_value: Any,
    conversion_error: str | None,
) -> None:
    source_column = source_column_for_transform(transform)
    if conversion_error is not None:
        collector.add(
            "error",
            conversion_error,
            source_row_number,
            output_column=transform.output_column,
            source_column=source_column,
            value=raw_value,
        )
        return

    if transform.required and is_missing_or_empty(converted_value):
        collector.add(
            "error",
            "REQUIRED_VALUE_MISSING",
            source_row_number,
            output_column=transform.output_column,
            source_column=source_column,
            value=raw_value,
        )


def resolve_arithmetic_operand(
    row: pd.Series,
    operand: Any,
) -> tuple[Decimal | None, Any, str | None]:
    raw_value = (
        row[operand.value]
        if operand.type == "SOURCE"
        else operand.value
    )
    return parse_decimal(raw_value), raw_value, (
        operand.value if operand.type == "SOURCE" else None
    )


def apply_arithmetic_transform(
    row: pd.Series,
    transform: ArithmeticColumnTransform,
    source_row_number: int,
    collector: ValidationIssueCollector,
) -> Any:
    left, raw_left, left_source = resolve_arithmetic_operand(
        row,
        transform.left_operand,
    )
    right, raw_right, right_source = resolve_arithmetic_operand(
        row,
        transform.right_operand,
    )

    invalid_operand = False
    if left is None:
        invalid_operand = True
        collector.add(
            "error",
            "INVALID_NUMERIC_OPERAND",
            source_row_number,
            output_column=transform.output_column,
            source_column=left_source,
            value=raw_left,
        )
    if right is None:
        invalid_operand = True
        collector.add(
            "error",
            "INVALID_NUMERIC_OPERAND",
            source_row_number,
            output_column=transform.output_column,
            source_column=right_source,
            value=raw_right,
        )
    if invalid_operand or left is None or right is None:
        return None

    if transform.operator == "ADD":
        result = left + right
    elif transform.operator == "SUBTRACT":
        result = left - right
    elif transform.operator == "MULTIPLY":
        result = left * right
    elif transform.operator == "DIVIDE":
        if right == 0:
            collector.add(
                "error",
                "DIVISION_BY_ZERO",
                source_row_number,
                output_column=transform.output_column,
                source_column=right_source,
                value=raw_right,
            )
            return None
        result = left / right
    else:
        raise ValueError(
            f"Operador aritmético no soportado: {transform.operator}",
        )

    if transform.output_type == "integer":
        if result != result.to_integral_value():
            collector.add(
                "error",
                "INVALID_INTEGER_RESULT",
                source_row_number,
                output_column=transform.output_column,
                value=result,
            )
            return None
        return int(result)

    quantum = Decimal(1).scaleb(-transform.decimal_places)
    return result.quantize(quantum, rounding=ROUND_HALF_UP)


def apply_value_map_transform(
    row: pd.Series,
    transform: ValueMapColumnTransform,
    source_row_number: int,
    collector: ValidationIssueCollector,
) -> tuple[Any, bool]:
    original_value = row[transform.source_column]
    normalized_mapping: dict[str, Any] = {}
    for key, mapped_value in transform.mapping.items():
        normalized_mapping.setdefault(
            normalize_comparison_text(key),
            mapped_value,
        )

    normalized_value = normalize_comparison_text(original_value)
    if normalized_value in normalized_mapping:
        return normalized_mapping[normalized_value], False

    if transform.unmapped_policy == "ERROR":
        collector.add(
            "error",
            "UNMAPPED_VALUE",
            source_row_number,
            output_column=transform.output_column,
            source_column=transform.source_column,
            value=original_value,
        )
        return None, True

    if transform.unmapped_policy == "KEEP_ORIGINAL":
        collector.add(
            "warning",
            "UNMAPPED_VALUE_KEPT",
            source_row_number,
            output_column=transform.output_column,
            source_column=transform.source_column,
            value=original_value,
        )
        return original_value, False

    collector.add(
        "warning",
        "UNMAPPED_VALUE_DEFAULTED",
        source_row_number,
        output_column=transform.output_column,
        source_column=transform.source_column,
        value=original_value,
    )
    return transform.default_value, False


def build_output_dataframe(
    dataframe: pd.DataFrame,
    config: TransformacionExcelConfig,
    collector: ValidationIssueCollector,
) -> tuple[pd.DataFrame, list[str]]:
    ordered_transforms = sorted(
        config.output_columns,
        key=lambda transform: transform.position,
    )
    output_columns = [
        transform.output_column
        for transform in ordered_transforms
    ]
    output_dataframe = pd.DataFrame(
        index=dataframe.index,
        columns=output_columns,
        dtype=object,
    )

    for index, row in dataframe.iterrows():
        source_row_number = int(row[SOURCE_ROW_NUMBER])

        for transform in ordered_transforms:
            operation_failed = False
            date_format = getattr(transform, "date_format", None)

            if transform.operation == "SOURCE":
                raw_value = row[transform.source_column]
            elif transform.operation == "CONSTANT":
                raw_value = transform.value
            elif transform.operation == "CONCAT":
                parts: list[str] = []
                for part in transform.parts:
                    if part.type == "LITERAL":
                        parts.append(part.value)
                    else:
                        source_text = normalize_text(row[part.value])
                        parts.append(source_text or "")
                raw_value = "".join(parts)
            elif transform.operation == "ARITHMETIC":
                raw_value = apply_arithmetic_transform(
                    row,
                    transform,
                    source_row_number,
                    collector,
                )
                operation_failed = raw_value is None
            elif transform.operation == "VALUE_MAP":
                raw_value, operation_failed = apply_value_map_transform(
                    row,
                    transform,
                    source_row_number,
                    collector,
                )
            else:
                raise ValueError(
                    f"Operación no soportada: {transform.operation}",
                )

            if operation_failed:
                output_dataframe.at[index, transform.output_column] = None
                continue

            converted_value, conversion_error = convert_output_value(
                raw_value,
                transform.output_type,
                date_format,
            )
            if conversion_error is None:
                converted_value = apply_configured_decimal_places(
                    converted_value,
                    transform,
                )
            output_dataframe.at[index, transform.output_column] = converted_value
            add_conversion_or_required_issue(
                collector,
                transform,
                source_row_number,
                raw_value,
                converted_value,
                conversion_error,
            )

    return output_dataframe, output_columns


def resolve_output_columns(
    configured_columns: list[str],
    output_columns: list[str],
) -> list[str]:
    output_by_normalized_name = {
        output_column.strip().casefold(): output_column
        for output_column in output_columns
    }
    return [
        output_by_normalized_name[column.strip().casefold()]
        for column in configured_columns
    ]


def apply_deduplication(
    dataframe: pd.DataFrame,
    source_rows: pd.Series,
    config: TransformacionExcelConfig,
    output_columns: list[str],
    collector: ValidationIssueCollector,
) -> tuple[pd.DataFrame, pd.Series, int, int]:
    duplicate_config = config.rows.remove_duplicates
    if not duplicate_config.enabled or dataframe.empty:
        return dataframe, source_rows, 0, 0

    duplicate_columns = resolve_output_columns(
        duplicate_config.by_output_columns,
        output_columns,
    )
    duplicate_mask = dataframe.duplicated(
        subset=duplicate_columns,
        keep=False,
    )
    removed_mask = dataframe.duplicated(
        subset=duplicate_columns,
        keep="first",
    )

    for index in dataframe.index[removed_mask]:
        collector.add(
            "warning",
            "DUPLICATES_REMOVED",
            int(source_rows.at[index]),
        )

    kept_indices = dataframe.index[~removed_mask]
    return (
        dataframe.loc[kept_indices].copy(),
        source_rows.loc[kept_indices].copy(),
        int(duplicate_mask.sum()),
        int(removed_mask.sum()),
    )


def apply_sorting(
    dataframe: pd.DataFrame,
    config: TransformacionExcelConfig,
    output_columns: list[str],
) -> pd.DataFrame:
    if not config.rows.sort_by or dataframe.empty:
        return dataframe

    sort_columns = resolve_output_columns(
        [rule.output_column for rule in config.rows.sort_by],
        output_columns,
    )
    ascending = [
        rule.direction == "ASC"
        for rule in config.rows.sort_by
    ]
    return dataframe.sort_values(
        by=sort_columns,
        ascending=ascending,
        na_position="last",
        kind="mergesort",
    )


def dataframe_preview(
    dataframe: pd.DataFrame,
    output_columns: list[str],
    preview_limit: int,
) -> list[dict[str, object]]:
    return [
        {
            column: serialize_json_value(row[column])
            for column in output_columns
        }
        for _, row in dataframe.head(preview_limit).iterrows()
    ]


def run_transformacion_pipeline(
    source_dataframe: pd.DataFrame,
    config: TransformacionExcelConfig,
    preview_limit: int,
) -> dict[str, Any]:
    dataframe = source_dataframe.reset_index(drop=True).copy()
    dataframe[SOURCE_ROW_NUMBER] = [
        config.source.header_row + 1 + index
        for index in range(len(dataframe))
    ]
    collector = ValidationIssueCollector()
    total_rows = len(dataframe)

    filtered_dataframe = apply_filters(dataframe, config, collector)
    rows_after_filters = len(filtered_dataframe)
    output_dataframe, output_columns = build_output_dataframe(
        filtered_dataframe,
        config,
        collector,
    )

    valid_indices = [
        index
        for index in filtered_dataframe.index
        if int(filtered_dataframe.at[index, SOURCE_ROW_NUMBER])
        not in collector.error_rows
    ]
    valid_dataframe = output_dataframe.loc[valid_indices].copy()
    valid_source_rows = filtered_dataframe.loc[
        valid_indices,
        SOURCE_ROW_NUMBER,
    ].copy()

    (
        deduplicated_dataframe,
        _deduplicated_source_rows,
        duplicates_detected,
        duplicates_removed,
    ) = apply_deduplication(
        valid_dataframe,
        valid_source_rows,
        config,
        output_columns,
        collector,
    )
    final_dataframe = apply_sorting(
        deduplicated_dataframe,
        config,
        output_columns,
    )

    return {
        "valid": not collector.error_rows,
        "total_filas_entrada": total_rows,
        "filas_despues_filtros": rows_after_filters,
        "filas_excluidas_por_filtros": total_rows - rows_after_filters,
        "filas_validas": len(final_dataframe),
        "filas_con_errores": len(collector.error_rows),
        "filas_con_advertencias": len(collector.warning_rows),
        "duplicados_detectados": duplicates_detected,
        "duplicados_eliminados": duplicates_removed,
        "columnas_salida": output_columns,
        "preview_rows": dataframe_preview(
            final_dataframe,
            output_columns,
            preview_limit,
        ),
        "errors": collector.build("error"),
        "warnings": collector.build("warning"),
    }
