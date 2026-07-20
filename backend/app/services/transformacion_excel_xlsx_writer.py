from __future__ import annotations

from pathlib import Path
import os
import tempfile
from typing import Any

from openpyxl.styles import Font
import pandas as pd
from pandas import DataFrame

from app.schemas.transformacion_excel import TransformacionExcelConfig


MIN_COLUMN_WIDTH = 10
MAX_COLUMN_WIDTH = 60
DEFAULT_DATE_FORMAT = "yyyy-mm-dd"
FORMULA_PREFIXES = ("=", "+", "-", "@")
INVALID_SHEET_NAME_CHARACTERS = set("[]:*?/\\")


class TransformacionExcelXlsxWriterError(Exception):
    pass


def validate_output_file_name(file_name: str) -> str:
    normalized = file_name.strip()
    if not normalized:
        raise TransformacionExcelXlsxWriterError(
            "El nombre del archivo de salida no puede estar vacío.",
        )
    if "/" in normalized or "\\" in normalized:
        raise TransformacionExcelXlsxWriterError(
            "El nombre del archivo de salida no puede contener rutas.",
        )
    if normalized in {".", ".."} or Path(normalized).name != normalized:
        raise TransformacionExcelXlsxWriterError(
            "El nombre del archivo de salida no es válido.",
        )
    if not normalized.lower().endswith(".xlsx"):
        raise TransformacionExcelXlsxWriterError(
            "El nombre del archivo de salida debe terminar en .xlsx.",
        )
    return normalized


def validate_sheet_name(sheet_name: str) -> str:
    normalized = sheet_name.strip()
    if not normalized:
        raise TransformacionExcelXlsxWriterError(
            "El nombre de la hoja no puede estar vacío.",
        )
    if len(normalized) > 31:
        raise TransformacionExcelXlsxWriterError(
            "El nombre de la hoja no puede superar 31 caracteres.",
        )
    if any(character in normalized for character in INVALID_SHEET_NAME_CHARACTERS):
        raise TransformacionExcelXlsxWriterError(
            "El nombre de la hoja contiene caracteres no permitidos.",
        )
    return normalized


def build_output_path(output_directory: Path, file_name: str) -> Path:
    safe_file_name = validate_output_file_name(file_name)
    directory = output_directory.resolve()
    candidate = (directory / safe_file_name).resolve()
    if not candidate.is_relative_to(directory):
        raise TransformacionExcelXlsxWriterError(
            "La ruta de salida queda fuera del storage permitido.",
        )
    return candidate


def protect_formula_injection(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    stripped = value.lstrip()
    if stripped.startswith(FORMULA_PREFIXES):
        return f"'{value}"
    return value


def build_safe_dataframe(
    dataframe: DataFrame,
    config: TransformacionExcelConfig,
) -> DataFrame:
    safe_dataframe = dataframe.copy(deep=True)
    for transform in config.output_columns:
        if (
            transform.output_type == "text"
            and transform.output_column in safe_dataframe.columns
        ):
            safe_dataframe[transform.output_column] = safe_dataframe[
                transform.output_column
            ].map(protect_formula_injection)
    return safe_dataframe


def to_excel_date_format(date_format: str | None) -> str:
    if not date_format:
        return DEFAULT_DATE_FORMAT
    if "%" not in date_format:
        return date_format

    converted = date_format
    for python_token, excel_token in (
        ("%Y", "yyyy"),
        ("%y", "yy"),
        ("%m", "mm"),
        ("%d", "dd"),
        ("%H", "hh"),
        ("%M", "mm"),
        ("%S", "ss"),
    ):
        converted = converted.replace(python_token, excel_token)
    return converted


def decimal_number_format(decimal_places: int | None) -> str:
    places = decimal_places if decimal_places is not None else 2
    if places <= 0:
        return "#,##0"
    return f"#,##0.{''.join('0' for _ in range(places))}"


def apply_column_formats(
    worksheet: Any,
    dataframe: DataFrame,
    config: TransformacionExcelConfig,
) -> None:
    transforms_by_column = {
        transform.output_column: transform
        for transform in config.output_columns
    }
    for column_index, column_name in enumerate(dataframe.columns, start=1):
        transform = transforms_by_column.get(str(column_name))
        if transform is None:
            continue

        if transform.output_type == "date":
            number_format = to_excel_date_format(
                getattr(transform, "date_format", None),
            )
        elif transform.output_type == "decimal":
            number_format = decimal_number_format(
                getattr(transform, "decimal_places", None),
            )
        elif transform.output_type == "integer":
            number_format = "0"
        else:
            number_format = "@"

        for row_index in range(2, worksheet.max_row + 1):
            worksheet.cell(
                row=row_index,
                column=column_index,
            ).number_format = number_format


def apply_auto_width(worksheet: Any) -> None:
    for column_cells in worksheet.columns:
        column_letter = column_cells[0].column_letter
        max_length = max(
            len(str(cell.value)) if cell.value is not None else 0
            for cell in column_cells
        )
        worksheet.column_dimensions[column_letter].width = min(
            max(max_length + 2, MIN_COLUMN_WIDTH),
            MAX_COLUMN_WIDTH,
        )


def write_workbook(
    dataframe: DataFrame,
    config: TransformacionExcelConfig,
    output_path: Path,
) -> None:
    sheet_name = validate_sheet_name(config.output.sheet_name)
    safe_dataframe = build_safe_dataframe(dataframe, config)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        safe_dataframe.to_excel(
            writer,
            sheet_name=sheet_name,
            index=False,
        )
        worksheet = writer.book[sheet_name]

        for cell in worksheet[1]:
            cell.font = Font(bold=True)

        worksheet.freeze_panes = (
            "A2"
            if config.output.freeze_header
            else None
        )
        if config.output.auto_filter:
            worksheet.auto_filter.ref = worksheet.dimensions
        if config.output.auto_width:
            apply_auto_width(worksheet)

        apply_column_formats(
            worksheet,
            safe_dataframe,
            config,
        )


def write_transformacion_xlsx(
    dataframe: DataFrame,
    config: TransformacionExcelConfig,
    output_path: Path,
) -> None:
    validate_output_file_name(output_path.name)
    validate_sheet_name(config.output.sheet_name)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=output_path.parent,
            prefix=f".{output_path.stem}.",
            suffix=".tmp.xlsx",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)

        write_workbook(dataframe, config, temporary_path)
        if (
            not temporary_path.exists()
            or temporary_path.stat().st_size <= 0
        ):
            raise TransformacionExcelXlsxWriterError(
                "El archivo XLSX temporal no se generó correctamente.",
            )

        os.replace(temporary_path, output_path)
        temporary_path = None
    except TransformacionExcelXlsxWriterError:
        raise
    except Exception as exc:
        raise TransformacionExcelXlsxWriterError(
            "No se pudo generar el archivo XLSX.",
        ) from exc
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
