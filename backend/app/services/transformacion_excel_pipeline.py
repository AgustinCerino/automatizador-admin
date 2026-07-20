from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import math
import re
from typing import Any, Literal

import pandas as pd

from app.schemas.transformacion_excel import (
    ArithmeticColumnTransform,
    OutputColumnTransform,
    SourceColumnTransform,
    TransformacionExcelConfig,
    TransformacionFilterRule,
    ValueMapColumnTransform,
)


SOURCE_ROW_NUMBER = "__source_row_number__"
MAX_ISSUE_SAMPLES = 10
IssueSeverity = Literal["ERROR", "WARNING"]

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
    "ROWS_FILTERED_OUT": "Hay filas excluidas por los filtros configurados.",
}

_VALUE_NOT_PROVIDED = object()


@dataclass
class TransformacionPipelineIssue:
    code: str
    message: str
    output_column: str | None
    source_column: str | None
    severity: IssueSeverity
    source_row_numbers: set[int] = field(default_factory=set)
    samples: list[dict[str, object]] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.source_row_numbers)

    def add_row(
        self,
        source_row_number: int,
        value: Any = _VALUE_NOT_PROVIDED,
    ) -> None:
        if source_row_number in self.source_row_numbers:
            return

        self.source_row_numbers.add(source_row_number)
        if len(self.samples) >= MAX_ISSUE_SAMPLES:
            return

        sample: dict[str, object] = {
            "source_row_number": source_row_number,
        }
        if value is not _VALUE_NOT_PROVIDED:
            sample["value"] = value
        self.samples.append(sample)


@dataclass(frozen=True)
class TransformacionPipelineMetrics:
    total_filas_entrada: int
    filas_despues_filtros: int
    filas_excluidas_por_filtros: int
    filas_con_errores: int
    filas_con_advertencias: int
    filas_validas: int
    duplicados_detectados: int
    duplicados_eliminados: int


@dataclass
class TransformacionPipelineResult:
    valid: bool
    final_dataframe: pd.DataFrame
    metrics: TransformacionPipelineMetrics
    errors: list[TransformacionPipelineIssue]
    warnings: list[TransformacionPipelineIssue]
    output_columns: list[str]

    def raise_if_invalid(self) -> None:
        if not self.valid:
            raise TransformacionPipelineInvalidResultError(self)


class TransformacionPipelineInvalidResultError(Exception):
    def __init__(self, result: TransformacionPipelineResult) -> None:
        self.result = result
        super().__init__("La transformación contiene errores de validación.")


@dataclass
class _OperationResult:
    value: Any
    source_column: str | None = None
    failed: bool = False


class _ValidationIssueCollector:
    def __init__(self) -> None:
        self._issues: dict[
            tuple[IssueSeverity, str, str | None, str | None],
            TransformacionPipelineIssue,
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
        issue = self._issues.setdefault(
            key,
            TransformacionPipelineIssue(
                code=code,
                message=ISSUE_MESSAGES[code],
                output_column=output_column,
                source_column=source_column,
                severity=severity,
            ),
        )
        issue.add_row(source_row_number, value)

        if severity == "ERROR":
            self.error_rows.add(source_row_number)
        else:
            self.warning_rows.add(source_row_number)

    def by_severity(
        self,
        severity: IssueSeverity,
    ) -> list[TransformacionPipelineIssue]:
        return [
            issue
            for issue in self._issues.values()
            if issue.severity == severity
        ]


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def _normalize_empty_value(value: Any) -> Any:
    if _is_missing(value):
        return None
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None
    return value


def _convert_to_text(value: Any) -> str | None:
    normalized = _normalize_empty_value(value)
    if normalized is None:
        return None
    return str(normalized).strip() or None


def _normalize_comparison_text(value: Any) -> str:
    normalized = _convert_to_text(value)
    return "" if normalized is None else normalized.casefold()


def _strip_numeric_sign(text: str) -> tuple[str, str]:
    if text.startswith(("+", "-")):
        return text[0], text[1:]
    return "", text


def _valid_grouped_integer(value: str, separator: str) -> bool:
    groups = value.split(separator)
    return (
        len(groups) > 1
        and 1 <= len(groups[0]) <= 3
        and groups[0].isdigit()
        and all(len(group) == 3 and group.isdigit() for group in groups[1:])
    )


def _normalize_decimal_text(value: str) -> str | None:
    text = value.strip()
    if not text or re.search(r"\s", text):
        return None

    sign, unsigned = _strip_numeric_sign(text)
    if not unsigned:
        return None

    comma_count = unsigned.count(",")
    dot_count = unsigned.count(".")
    if comma_count and dot_count:
        decimal_separator = (
            "," if unsigned.rfind(",") > unsigned.rfind(".") else "."
        )
        thousands_separator = "." if decimal_separator == "," else ","
        if unsigned.count(decimal_separator) != 1:
            return None
        integer_part, decimal_part = unsigned.rsplit(decimal_separator, 1)
        if (
            not decimal_part.isdigit()
            or not _valid_grouped_integer(
                integer_part,
                thousands_separator,
            )
        ):
            return None
        integer_digits = integer_part.replace(thousands_separator, "")
        return f"{sign}{integer_digits}.{decimal_part}"

    separator = "," if comma_count else "." if dot_count else None
    if separator is None:
        return f"{sign}{unsigned}" if unsigned.isdigit() else None

    separator_count = unsigned.count(separator)
    if separator_count > 1:
        if not _valid_grouped_integer(unsigned, separator):
            return None
        return f"{sign}{unsigned.replace(separator, '')}"

    integer_part, decimal_part = unsigned.split(separator)
    if not integer_part.isdigit() or not decimal_part.isdigit():
        return None

    if 1 <= len(integer_part) <= 3 and len(decimal_part) == 3:
        return None
    return f"{sign}{integer_part}.{decimal_part}"


def _convert_to_decimal(value: Any) -> Decimal | None:
    normalized = _normalize_empty_value(value)
    if normalized is None or isinstance(normalized, bool):
        return None

    if isinstance(normalized, Decimal):
        return normalized if normalized.is_finite() else None
    if isinstance(normalized, int):
        return Decimal(normalized)
    if isinstance(normalized, float):
        if not math.isfinite(normalized):
            return None
        return Decimal(str(normalized))

    normalized_text = _normalize_decimal_text(str(normalized))
    if normalized_text is None:
        return None
    try:
        parsed = Decimal(normalized_text)
    except (InvalidOperation, ValueError):
        return None
    return parsed if parsed.is_finite() else None


def _convert_to_integer(value: Any) -> int | None:
    parsed = _convert_to_decimal(value)
    if parsed is None or parsed != parsed.to_integral_value():
        return None
    return int(parsed)


def _convert_to_date(value: Any) -> date | None:
    normalized = _normalize_empty_value(value)
    if normalized is None or isinstance(
        normalized,
        (bool, int, float, Decimal),
    ):
        return None

    if isinstance(normalized, pd.Timestamp):
        return normalized.date()
    if isinstance(normalized, datetime):
        return normalized.date()
    if isinstance(normalized, date):
        return normalized

    text = str(normalized)
    if re.fullmatch(r"[-+]?\d+(?:[.,]\d+)?", text):
        return None

    for date_format in (
        "%Y-%m-%d",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d/%m/%Y %H:%M:%S",
    ):
        try:
            return datetime.strptime(text, date_format).date()
        except ValueError:
            continue
    return None


def _convert_output_value(
    value: Any,
    output_type: str,
    decimal_places: int | None = None,
) -> tuple[Any, str | None]:
    normalized = _normalize_empty_value(value)
    if normalized is None:
        return None, None

    if output_type == "text":
        return _convert_to_text(normalized), None
    if output_type == "decimal":
        parsed_decimal = _convert_to_decimal(normalized)
        if parsed_decimal is None:
            return None, "INVALID_DECIMAL"
        if decimal_places is not None:
            quantum = Decimal(1).scaleb(-decimal_places)
            parsed_decimal = parsed_decimal.quantize(
                quantum,
                rounding=ROUND_HALF_UP,
            )
        return parsed_decimal, None
    if output_type == "integer":
        parsed_integer = _convert_to_integer(normalized)
        if parsed_integer is None:
            return None, "INVALID_INTEGER"
        return parsed_integer, None
    if output_type == "date":
        parsed_date = _convert_to_date(normalized)
        if parsed_date is None:
            return None, "INVALID_DATE"
        return parsed_date, None
    raise ValueError(f"Tipo de salida no soportado: {output_type}")


def _evaluate_filter(
    value: Any,
    rule: TransformacionFilterRule,
) -> tuple[bool, bool]:
    if rule.operator == "NOT_EMPTY":
        return _normalize_empty_value(value) is not None, False
    if rule.operator == "IS_EMPTY":
        return _normalize_empty_value(value) is None, False
    if rule.operator == "EQUALS":
        return (
            _normalize_comparison_text(value)
            == _normalize_comparison_text(rule.value)
        ), False
    if rule.operator == "IN":
        allowed_values = {
            _normalize_comparison_text(item)
            for item in (rule.values or [])
        }
        return _normalize_comparison_text(value) in allowed_values, False
    if rule.operator == "CONTAINS":
        expected = _normalize_comparison_text(rule.value)
        return expected in _normalize_comparison_text(value), False
    if rule.operator in {"GREATER_THAN", "LESS_THAN"}:
        current_number = _convert_to_decimal(value)
        expected_number = _convert_to_decimal(rule.value)
        if current_number is None or expected_number is None:
            return False, True
        if rule.operator == "GREATER_THAN":
            return current_number > expected_number, False
        return current_number < expected_number, False
    raise ValueError(f"Operador de filtro no soportado: {rule.operator}")


def _apply_filters(
    dataframe: pd.DataFrame,
    config: TransformacionExcelConfig,
    collector: _ValidationIssueCollector,
    row_number_column: str,
) -> pd.DataFrame:
    if not config.rows.filters:
        return dataframe.copy()

    passed_by_index = {index: True for index in dataframe.index}
    filter_error_indices: set[int] = set()

    for rule in config.rows.filters:
        for index, value in dataframe[rule.source_column].items():
            matches, has_error = _evaluate_filter(value, rule)
            source_row_number = int(dataframe.at[index, row_number_column])
            if has_error:
                filter_error_indices.add(index)
                collector.add(
                    "ERROR",
                    "INVALID_FILTER_VALUE",
                    source_row_number,
                    source_column=rule.source_column,
                    value=value,
                )
                passed_by_index[index] = False
            else:
                passed_by_index[index] = (
                    passed_by_index[index] and matches
                )

    passed_indices = [
        index
        for index in dataframe.index
        if passed_by_index[index] and index not in filter_error_indices
    ]
    passed_index_set = set(passed_indices)
    for index in dataframe.index:
        if index in passed_index_set or index in filter_error_indices:
            continue
        collector.add(
            "WARNING",
            "ROWS_FILTERED_OUT",
            int(dataframe.at[index, row_number_column]),
        )

    return dataframe.loc[passed_indices].copy()


def _source_column_for_transform(
    transform: OutputColumnTransform,
) -> str | None:
    if isinstance(transform, (SourceColumnTransform, ValueMapColumnTransform)):
        return transform.source_column
    return None


def _apply_source_operation(
    row: pd.Series,
    transform: Any,
) -> _OperationResult:
    return _OperationResult(
        value=row[transform.source_column],
        source_column=transform.source_column,
    )


def _apply_constant_operation(transform: Any) -> _OperationResult:
    return _OperationResult(value=transform.value)


def _apply_concat_operation(
    row: pd.Series,
    transform: Any,
) -> _OperationResult:
    parts: list[str] = []
    for part in transform.parts:
        if part.type == "LITERAL":
            parts.append(part.value)
        else:
            parts.append(_convert_to_text(row[part.value]) or "")
    return _OperationResult(value="".join(parts))


def _resolve_arithmetic_operand(
    row: pd.Series,
    operand: Any,
) -> tuple[Decimal | None, Any, str | None]:
    raw_value = (
        row[operand.value]
        if operand.type == "SOURCE"
        else operand.value
    )
    return (
        _convert_to_decimal(raw_value),
        raw_value,
        operand.value if operand.type == "SOURCE" else None,
    )


def _apply_arithmetic_operation(
    row: pd.Series,
    transform: ArithmeticColumnTransform,
    source_row_number: int,
    collector: _ValidationIssueCollector,
) -> _OperationResult:
    left, raw_left, left_source = _resolve_arithmetic_operand(
        row,
        transform.left_operand,
    )
    right, raw_right, right_source = _resolve_arithmetic_operand(
        row,
        transform.right_operand,
    )

    failed = False
    if left is None:
        failed = True
        collector.add(
            "ERROR",
            "INVALID_NUMERIC_OPERAND",
            source_row_number,
            output_column=transform.output_column,
            source_column=left_source,
            value=raw_left,
        )
    if right is None:
        failed = True
        collector.add(
            "ERROR",
            "INVALID_NUMERIC_OPERAND",
            source_row_number,
            output_column=transform.output_column,
            source_column=right_source,
            value=raw_right,
        )
    if failed or left is None or right is None:
        return _OperationResult(value=None, failed=True)

    if transform.operator == "ADD":
        result = left + right
    elif transform.operator == "SUBTRACT":
        result = left - right
    elif transform.operator == "MULTIPLY":
        result = left * right
    elif transform.operator == "DIVIDE":
        if right == 0:
            collector.add(
                "ERROR",
                "DIVISION_BY_ZERO",
                source_row_number,
                output_column=transform.output_column,
                source_column=right_source,
                value=raw_right,
            )
            return _OperationResult(value=None, failed=True)
        result = left / right
    else:
        raise ValueError(
            f"Operador aritmético no soportado: {transform.operator}",
        )

    if (
        transform.output_type == "integer"
        and result != result.to_integral_value()
    ):
        collector.add(
            "ERROR",
            "INVALID_INTEGER_RESULT",
            source_row_number,
            output_column=transform.output_column,
            value=result,
        )
        return _OperationResult(value=None, failed=True)
    return _OperationResult(value=result)


def _apply_value_map_operation(
    row: pd.Series,
    transform: ValueMapColumnTransform,
    source_row_number: int,
    collector: _ValidationIssueCollector,
) -> _OperationResult:
    original_value = row[transform.source_column]
    normalized_mapping: dict[str, Any] = {}
    for key, mapped_value in transform.mapping.items():
        normalized_mapping.setdefault(
            _normalize_comparison_text(key),
            mapped_value,
        )

    normalized_value = _normalize_comparison_text(original_value)
    if normalized_value in normalized_mapping:
        return _OperationResult(
            value=normalized_mapping[normalized_value],
            source_column=transform.source_column,
        )

    if transform.unmapped_policy == "ERROR":
        collector.add(
            "ERROR",
            "UNMAPPED_VALUE",
            source_row_number,
            output_column=transform.output_column,
            source_column=transform.source_column,
            value=original_value,
        )
        return _OperationResult(
            value=None,
            source_column=transform.source_column,
            failed=True,
        )

    warning_code = (
        "UNMAPPED_VALUE_KEPT"
        if transform.unmapped_policy == "KEEP_ORIGINAL"
        else "UNMAPPED_VALUE_DEFAULTED"
    )
    collector.add(
        "WARNING",
        warning_code,
        source_row_number,
        output_column=transform.output_column,
        source_column=transform.source_column,
        value=original_value,
    )
    return _OperationResult(
        value=(
            original_value
            if transform.unmapped_policy == "KEEP_ORIGINAL"
            else transform.default_value
        ),
        source_column=transform.source_column,
    )


def _dispatch_operation(
    row: pd.Series,
    transform: OutputColumnTransform,
    source_row_number: int,
    collector: _ValidationIssueCollector,
) -> _OperationResult:
    if transform.operation == "SOURCE":
        return _apply_source_operation(row, transform)
    if transform.operation == "CONSTANT":
        return _apply_constant_operation(transform)
    if transform.operation == "CONCAT":
        return _apply_concat_operation(row, transform)
    if transform.operation == "ARITHMETIC":
        return _apply_arithmetic_operation(
            row,
            transform,
            source_row_number,
            collector,
        )
    if transform.operation == "VALUE_MAP":
        return _apply_value_map_operation(
            row,
            transform,
            source_row_number,
            collector,
        )
    raise ValueError(f"Operación no soportada: {transform.operation}")


def _apply_output_columns(
    dataframe: pd.DataFrame,
    config: TransformacionExcelConfig,
    collector: _ValidationIssueCollector,
    row_number_column: str,
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
        source_row_number = int(row[row_number_column])
        for transform in ordered_transforms:
            operation_result = _dispatch_operation(
                row,
                transform,
                source_row_number,
                collector,
            )
            if operation_result.failed:
                output_dataframe.at[index, transform.output_column] = None
                continue

            converted_value, conversion_error = _convert_output_value(
                operation_result.value,
                transform.output_type,
                getattr(transform, "decimal_places", None),
            )
            output_dataframe.at[index, transform.output_column] = converted_value
            source_column = (
                operation_result.source_column
                or _source_column_for_transform(transform)
            )

            if conversion_error is not None:
                collector.add(
                    "ERROR",
                    conversion_error,
                    source_row_number,
                    output_column=transform.output_column,
                    source_column=source_column,
                    value=operation_result.value,
                )
                continue

            if (
                transform.required
                and _normalize_empty_value(converted_value) is None
            ):
                collector.add(
                    "ERROR",
                    "REQUIRED_VALUE_MISSING",
                    source_row_number,
                    output_column=transform.output_column,
                    source_column=source_column,
                    value=operation_result.value,
                )

    return output_dataframe, output_columns


def _resolve_output_columns(
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


def _apply_deduplication(
    dataframe: pd.DataFrame,
    source_rows: pd.Series,
    config: TransformacionExcelConfig,
    output_columns: list[str],
    collector: _ValidationIssueCollector,
) -> tuple[pd.DataFrame, pd.Series, int, int]:
    duplicate_config = config.rows.remove_duplicates
    if not duplicate_config.enabled or dataframe.empty:
        return dataframe, source_rows, 0, 0

    duplicate_columns = _resolve_output_columns(
        duplicate_config.by_output_columns,
        output_columns,
    )
    removed_mask = dataframe.duplicated(
        subset=duplicate_columns,
        keep="first",
    )
    duplicates_detected = int(removed_mask.sum())

    for index in dataframe.index[removed_mask]:
        collector.add(
            "WARNING",
            "DUPLICATES_REMOVED",
            int(source_rows.at[index]),
        )

    kept_indices = dataframe.index[~removed_mask]
    return (
        dataframe.loc[kept_indices].copy(),
        source_rows.loc[kept_indices].copy(),
        duplicates_detected,
        duplicates_detected,
    )


def _apply_sorting(
    dataframe: pd.DataFrame,
    config: TransformacionExcelConfig,
    output_columns: list[str],
) -> pd.DataFrame:
    if not config.rows.sort_by or dataframe.empty:
        return dataframe

    sorted_dataframe = dataframe
    for rule in reversed(config.rows.sort_by):
        sort_column = _resolve_output_columns(
            [rule.output_column],
            output_columns,
        )[0]
        sorted_dataframe = sorted_dataframe.sort_values(
            by=sort_column,
            ascending=rule.direction == "ASC",
            na_position="last",
            kind="mergesort",
        )
    return sorted_dataframe


def _internal_row_number_column(dataframe: pd.DataFrame) -> str:
    name = SOURCE_ROW_NUMBER
    while name in dataframe.columns:
        name = f"_{name}"
    return name


def run_transformacion_pipeline(
    source_dataframe: pd.DataFrame,
    config: TransformacionExcelConfig,
) -> TransformacionPipelineResult:
    dataframe = source_dataframe.copy(deep=True).reset_index(drop=True)
    row_number_column = _internal_row_number_column(dataframe)
    dataframe[row_number_column] = [
        config.source.header_row + 1 + index
        for index in range(len(dataframe))
    ]
    collector = _ValidationIssueCollector()
    total_rows = len(dataframe)

    filtered_dataframe = _apply_filters(
        dataframe,
        config,
        collector,
        row_number_column,
    )
    rows_after_filters = len(filtered_dataframe)
    output_dataframe, output_columns = _apply_output_columns(
        filtered_dataframe,
        config,
        collector,
        row_number_column,
    )

    valid_indices = [
        index
        for index in filtered_dataframe.index
        if int(filtered_dataframe.at[index, row_number_column])
        not in collector.error_rows
    ]
    valid_dataframe = output_dataframe.loc[
        valid_indices,
        output_columns,
    ].copy()
    valid_source_rows = filtered_dataframe.loc[
        valid_indices,
        row_number_column,
    ].copy()

    (
        deduplicated_dataframe,
        _deduplicated_source_rows,
        duplicates_detected,
        duplicates_removed,
    ) = _apply_deduplication(
        valid_dataframe,
        valid_source_rows,
        config,
        output_columns,
        collector,
    )
    sorted_dataframe = _apply_sorting(
        deduplicated_dataframe,
        config,
        output_columns,
    )
    final_dataframe = sorted_dataframe.loc[
        :,
        output_columns,
    ].reset_index(drop=True)

    metrics = TransformacionPipelineMetrics(
        total_filas_entrada=total_rows,
        filas_despues_filtros=rows_after_filters,
        filas_excluidas_por_filtros=total_rows - rows_after_filters,
        filas_con_errores=len(collector.error_rows),
        filas_con_advertencias=len(collector.warning_rows),
        filas_validas=len(final_dataframe),
        duplicados_detectados=duplicates_detected,
        duplicados_eliminados=duplicates_removed,
    )
    errors = collector.by_severity("ERROR")
    warnings = collector.by_severity("WARNING")
    return TransformacionPipelineResult(
        valid=not errors,
        final_dataframe=final_dataframe,
        metrics=metrics,
        errors=errors,
        warnings=warnings,
        output_columns=output_columns,
    )
