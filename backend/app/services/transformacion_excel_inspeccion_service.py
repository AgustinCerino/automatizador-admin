from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Archivo, Usuario
from app.services.file_preview_service import serialize_value
from app.services.file_service import STORAGE_ROOT
from app.services.transformacion_excel_security_service import (
    TransformacionExcelSecurityError,
    resolve_storage_path_safely,
    validate_dataframe_dimensions,
    validate_source_file_security,
)


SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
CSV_ENCODINGS = ("utf-8-sig", "utf-8", "latin-1")
BOOLEAN_TEXT_VALUES = {
    "true",
    "false",
    "yes",
    "no",
    "si",
    "sí",
    "y",
    "n",
    "0",
    "1",
}


class TransformacionExcelInspeccionError(Exception):
    status_code = 400

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        if status_code is not None:
            self.status_code = status_code


class TransformacionExcelInspeccionNotFoundError(
    TransformacionExcelInspeccionError,
):
    status_code = 404


class TransformacionExcelInspeccionForbiddenError(
    TransformacionExcelInspeccionError,
):
    status_code = 403


def get_archivo(
    db: Session,
    archivo_id: int,
    current_user: Usuario | None = None,
) -> Archivo:
    archivo = db.execute(
        select(Archivo).where(Archivo.id == archivo_id),
    ).scalar_one_or_none()
    if archivo is None:
        raise TransformacionExcelInspeccionNotFoundError("Archivo no encontrado")
    if (
        current_user is not None
        and archivo.ejecucion.proceso.cliente_id != current_user.cliente_id
    ):
        raise TransformacionExcelInspeccionForbiddenError(
            "El archivo pertenece a otro cliente",
        )
    return archivo


def normalize_extension(extension: str | None) -> str:
    normalized = (extension or "").lower()
    if normalized not in SUPPORTED_EXTENSIONS:
        allowed = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise TransformacionExcelInspeccionError(
            f"Extensión no soportada. Permitidas: {allowed}",
        )
    return normalized


def resolve_existing_storage_path(archivo: Archivo) -> Path:
    try:
        path = resolve_storage_path_safely(archivo.ruta_storage, STORAGE_ROOT)
        validate_source_file_security(path, archivo.extension or "")
        return path
    except TransformacionExcelSecurityError as exc:
        if exc.status_code == 404:
            raise TransformacionExcelInspeccionNotFoundError(str(exc)) from exc
        raise TransformacionExcelInspeccionError(
            str(exc),
            exc.status_code,
        ) from exc


def get_available_sheets(path: Path, extension: str) -> list[str]:
    if extension == ".csv":
        return []
    try:
        return list(pd.ExcelFile(path).sheet_names)
    except Exception as exc:
        raise TransformacionExcelInspeccionError(
            "No se pudieron leer las hojas del archivo.",
        ) from exc


def select_sheet_name(
    extension: str,
    available_sheets: list[str],
    sheet_name: str | None,
) -> str | None:
    if extension == ".csv":
        if sheet_name is not None:
            raise TransformacionExcelInspeccionError(
                "sheet_name no aplica para archivos CSV",
            )
        return None

    if not available_sheets:
        raise TransformacionExcelInspeccionError(
            "El archivo no contiene hojas disponibles",
        )
    if sheet_name is None:
        return available_sheets[0]
    if sheet_name not in available_sheets:
        raise TransformacionExcelInspeccionError(
            f"La hoja indicada no existe: {sheet_name}",
        )
    return sheet_name


def read_csv_with_encoding(path: Path, header_row: int) -> pd.DataFrame:
    last_error: Exception | None = None
    for encoding in CSV_ENCODINGS:
        try:
            return pd.read_csv(
                path,
                sep=None,
                engine="python",
                header=header_row - 1,
                encoding=encoding,
            )
        except UnicodeDecodeError as exc:
            last_error = exc
            continue
        except pd.errors.EmptyDataError as exc:
            raise TransformacionExcelInspeccionError(
                "El archivo CSV está vacío o no tiene encabezados",
            ) from exc
        except Exception as exc:
            last_error = exc
            continue

    raise TransformacionExcelInspeccionError(
        "No se pudo leer el archivo CSV.",
    )


def read_csv_headers(path: Path, header_row: int) -> list[str]:
    last_error: Exception | None = None
    for encoding in CSV_ENCODINGS:
        try:
            header_df = pd.read_csv(
                path,
                sep=None,
                engine="python",
                header=None,
                nrows=header_row,
                encoding=encoding,
            )
            if len(header_df) < header_row:
                raise TransformacionExcelInspeccionError(
                    "header_row excede el contenido disponible del CSV",
                )
            return [
                normalize_column_name(value)
                for value in header_df.iloc[header_row - 1].tolist()
            ]
        except UnicodeDecodeError as exc:
            last_error = exc
            continue
        except pd.errors.EmptyDataError as exc:
            raise TransformacionExcelInspeccionError(
                "El archivo CSV está vacío o no tiene encabezados",
            ) from exc
        except TransformacionExcelInspeccionError:
            raise
        except Exception as exc:
            last_error = exc
            continue

    raise TransformacionExcelInspeccionError(
        "No se pudieron leer encabezados del CSV.",
    )


def read_excel_dataframe(
    path: Path,
    selected_sheet_name: str,
    header_row: int,
) -> pd.DataFrame:
    try:
        return pd.read_excel(
            path,
            sheet_name=selected_sheet_name,
            header=header_row - 1,
        )
    except ValueError as exc:
        raise TransformacionExcelInspeccionError(
            "No se pudo leer la hoja seleccionada.",
        ) from exc
    except Exception as exc:
        raise TransformacionExcelInspeccionError(
            "No se pudo leer el archivo Excel.",
        ) from exc


def read_excel_headers(
    path: Path,
    selected_sheet_name: str,
    header_row: int,
) -> list[str]:
    try:
        header_df = pd.read_excel(
            path,
            sheet_name=selected_sheet_name,
            header=None,
            nrows=header_row,
        )
    except Exception as exc:
        raise TransformacionExcelInspeccionError(
            "No se pudieron leer encabezados del Excel.",
        ) from exc

    if len(header_df) < header_row:
        raise TransformacionExcelInspeccionError(
            "header_row excede el contenido disponible de la hoja",
        )
    return [
        normalize_column_name(value)
        for value in header_df.iloc[header_row - 1].tolist()
    ]


def read_source_dataframe(
    path: Path,
    extension: str,
    selected_sheet_name: str | None,
    header_row: int,
) -> pd.DataFrame:
    if header_row < 1:
        raise TransformacionExcelInspeccionError(
            "header_row debe ser mayor o igual a 1",
        )

    if extension == ".csv":
        df = read_csv_with_encoding(path, header_row)
    else:
        if selected_sheet_name is None:
            raise TransformacionExcelInspeccionError(
                "Debe indicarse una hoja para archivos Excel",
            )
        df = read_excel_dataframe(path, selected_sheet_name, header_row)

    if len(df.columns) == 0:
        raise TransformacionExcelInspeccionError(
            "No se pudieron obtener encabezados con el header_row indicado",
        )
    try:
        validate_dataframe_dimensions(df)
    except TransformacionExcelSecurityError as exc:
        raise TransformacionExcelInspeccionError(
            str(exc),
            exc.status_code,
        ) from exc
    return df


def get_raw_headers(
    path: Path,
    extension: str,
    selected_sheet_name: str | None,
    header_row: int,
) -> list[str]:
    if extension == ".csv":
        return read_csv_headers(path, header_row)
    if selected_sheet_name is None:
        raise TransformacionExcelInspeccionError(
            "Debe indicarse una hoja para archivos Excel",
        )
    return read_excel_headers(path, selected_sheet_name, header_row)


def normalize_column_name(column: Any) -> str:
    if column is None:
        return ""
    try:
        if pd.isna(column):
            return ""
    except (TypeError, ValueError):
        pass
    if isinstance(column, str) and column.startswith("Unnamed:"):
        return ""
    return str(column).strip()


def build_warnings(column_names: list[str]) -> list[dict[str, Any]]:
    warnings: list[dict[str, Any]] = []
    empty_columns = [name for name in column_names if not name]
    if empty_columns:
        warnings.append(
            {
                "code": "EMPTY_HEADERS",
                "message": "Se detectaron encabezados vacíos.",
                "columns": empty_columns,
            },
        )

    grouped: dict[str, list[str]] = defaultdict(list)
    for name in column_names:
        normalized = name.strip().lower()
        if normalized:
            grouped[normalized].append(name)

    duplicates = [
        name
        for names in grouped.values()
        if len(names) > 1
        for name in names
    ]
    if duplicates:
        warnings.append(
            {
                "code": "DUPLICATE_HEADERS",
                "message": "Se detectaron encabezados duplicados.",
                "columns": duplicates,
            },
        )

    return warnings


def validate_headers(column_names: list[str]) -> None:
    if not column_names or all(not name for name in column_names):
        raise TransformacionExcelInspeccionError(
            "El header_row indicado no permite obtener encabezados válidos",
        )


def is_boolean_series(values: pd.Series) -> bool:
    if values.empty:
        return False
    if pd.api.types.is_bool_dtype(values):
        return True
    if pd.api.types.is_numeric_dtype(values):
        return False
    normalized = {
        str(value).strip().lower()
        for value in values
        if str(value).strip()
    }
    return bool(normalized) and normalized.issubset(BOOLEAN_TEXT_VALUES)


def is_integer_numeric(values: pd.Series) -> bool:
    numeric_values = pd.to_numeric(values, errors="coerce")
    if numeric_values.isna().any():
        return False
    return bool((numeric_values % 1 == 0).all())


def is_decimal_numeric(values: pd.Series) -> bool:
    numeric_values = pd.to_numeric(values, errors="coerce")
    return not numeric_values.isna().any()


def is_likely_date_series(values: pd.Series) -> bool:
    if values.empty:
        return False
    if pd.api.types.is_datetime64_any_dtype(values):
        return True
    if pd.api.types.is_numeric_dtype(values):
        return False

    string_values = values.astype(str).str.strip()
    if string_values.empty:
        return False
    if string_values.str.fullmatch(r"[-+]?\d+(\.\d+)?").all():
        return False

    parsed = pd.to_datetime(string_values, errors="coerce", format="mixed")
    return parsed.notna().mean() >= 0.8


def detect_column_type(series: pd.Series) -> str:
    non_null = series.dropna()
    if non_null.empty:
        return "unknown"
    if is_boolean_series(non_null):
        return "boolean"
    if is_decimal_numeric(non_null):
        return "integer" if is_integer_numeric(non_null) else "decimal"
    if is_likely_date_series(non_null):
        return "date"
    if pd.api.types.is_string_dtype(non_null) or non_null.dtype == object:
        return "text"
    return "unknown"


def inspect_dataframe_columns(df: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {
            "name": normalize_column_name(column),
            "detected_type": detect_column_type(df.iloc[:, index]),
            "null_count": int(df.iloc[:, index].isna().sum()),
        }
        for index, column in enumerate(df.columns)
    ]


def dataframe_to_json_rows(df: pd.DataFrame, limit: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    preview_df = df.head(limit)
    for record in preview_df.to_dict(orient="records"):
        rows.append(
            {
                normalize_column_name(column): serialize_value(value)
                for column, value in record.items()
            },
        )
    return rows


def build_transformacion_excel_structure(
    db: Session,
    archivo_id: int,
    sheet_name: str | None,
    header_row: int,
    limit: int,
    current_user: Usuario | None = None,
) -> dict[str, Any]:
    archivo = get_archivo(db, archivo_id, current_user)
    extension = normalize_extension(archivo.extension)
    path = resolve_existing_storage_path(archivo)
    available_sheets = get_available_sheets(path, extension)
    selected_sheet_name = select_sheet_name(extension, available_sheets, sheet_name)
    raw_headers = get_raw_headers(path, extension, selected_sheet_name, header_row)
    df = read_source_dataframe(path, extension, selected_sheet_name, header_row)

    if len(raw_headers) == len(df.columns):
        df.columns = raw_headers

    column_names = [normalize_column_name(column) for column in df.columns]
    validate_headers(column_names)
    warnings = build_warnings(column_names)

    return {
        "archivo_id": archivo.id,
        "nombre_original": archivo.nombre_original,
        "extension": archivo.extension,
        "available_sheets": available_sheets,
        "selected_sheet_name": selected_sheet_name,
        "header_row": header_row,
        "columns": inspect_dataframe_columns(df),
        "rows": dataframe_to_json_rows(df, limit),
        "total_rows": int(len(df)),
        "preview_limit": limit,
        "warnings": warnings,
    }
