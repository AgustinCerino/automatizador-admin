from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from app.models import Archivo
from app.services.file_service import STORAGE_ROOT


SUPPORTED_PREVIEW_EXTENSIONS = {".csv", ".xlsx", ".xls"}
MAX_PREVIEW_LIMIT = 100


class FilePreviewError(Exception):
    pass


class UnsupportedPreviewExtensionError(FilePreviewError):
    pass


class StoredFileNotFoundError(FilePreviewError):
    pass


def normalize_preview_limit(limit: int) -> int:
    if limit < 1:
        return 1
    return min(limit, MAX_PREVIEW_LIMIT)


def resolve_storage_path(ruta_storage: str) -> Path:
    path = Path(ruta_storage)
    if path.is_absolute():
        return path
    return STORAGE_ROOT.parent / path


def validate_preview_extension(extension: str | None) -> str:
    normalized_extension = (extension or "").lower()
    if normalized_extension not in SUPPORTED_PREVIEW_EXTENSIONS:
        allowed = ", ".join(sorted(SUPPORTED_PREVIEW_EXTENSIONS))
        raise UnsupportedPreviewExtensionError(
            f"Extensión no soportada para preview. Permitidas: {allowed}",
        )
    return normalized_extension


def read_file_dataframe(path: Path, extension: str) -> pd.DataFrame:
    try:
        if extension == ".csv":
            return pd.read_csv(path)
        return pd.read_excel(path)
    except Exception as exc:
        raise FilePreviewError(f"No se pudo leer el archivo: {exc}") from exc


def serialize_value(value: Any) -> Any:
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, datetime | date):
        return value.isoformat()
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def serialize_rows(df: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for record in df.to_dict(orient="records"):
        rows.append(
            {
                str(column): serialize_value(value)
                for column, value in record.items()
            },
        )
    return rows


def build_file_preview(archivo: Archivo, limit: int) -> dict[str, Any]:
    preview_limit = normalize_preview_limit(limit)
    extension = validate_preview_extension(archivo.extension)
    path = resolve_storage_path(archivo.ruta_storage)

    if not path.exists() or not path.is_file():
        raise StoredFileNotFoundError("El archivo físico no existe")

    df = read_file_dataframe(path, extension)
    preview_df = df.head(preview_limit)

    return {
        "archivo_id": archivo.id,
        "nombre_original": archivo.nombre_original,
        "extension": archivo.extension,
        "columns": [str(column) for column in df.columns],
        "rows": serialize_rows(preview_df),
        "preview_limit": preview_limit,
        "total_rows": int(len(df)),
    }
