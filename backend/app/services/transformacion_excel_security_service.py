from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any
from zipfile import BadZipFile, ZipFile
import xml.etree.ElementTree as ElementTree

import pandas as pd
from pydantic import BaseModel

from app.core.config import settings


XLSX_EXTENSION = ".xlsx"
SIGNIFICANT_XLSX_UNCOMPRESSED_BYTES = 1024 * 1024


class TransformacionExcelSecurityError(Exception):
    status_code = 400

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int | None = None,
    ) -> None:
        self.code = code
        super().__init__(f"{code}: {message}")
        if status_code is not None:
            self.status_code = status_code


def resolve_storage_path_safely(
    stored_path: str | Path,
    allowed_root: Path,
) -> Path:
    root = allowed_root.resolve()
    raw_path = Path(stored_path)
    if raw_path.is_absolute():
        candidate = raw_path
    elif raw_path.parts and raw_path.parts[0].casefold() == root.name.casefold():
        candidate = root.parent / raw_path
    else:
        candidate = root / raw_path

    try:
        resolved = candidate.resolve(strict=False)
    except (OSError, RuntimeError) as exc:
        raise TransformacionExcelSecurityError(
            "UNSAFE_STORAGE_PATH",
            "La ubicación almacenada no es segura.",
        ) from exc

    if not resolved.is_relative_to(root):
        raise TransformacionExcelSecurityError(
            "UNSAFE_STORAGE_PATH",
            "La ubicación almacenada no es segura.",
        )
    return resolved


def calculate_file_sha256(path: Path) -> str:
    sha256 = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def calculate_transformacion_config_checksum(config: BaseModel | dict[str, Any]) -> str:
    payload = config.model_dump(mode="json") if isinstance(config, BaseModel) else config
    serialized = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


def _is_unsafe_zip_entry(filename: str) -> bool:
    normalized = filename.replace("\\", "/")
    posix_path = PurePosixPath(normalized)
    windows_path = PureWindowsPath(filename)
    return (
        normalized.startswith("/")
        or windows_path.is_absolute()
        or windows_path.drive != ""
        or ".." in posix_path.parts
    )


def validate_xlsx_container(path: Path) -> None:
    try:
        with ZipFile(path) as workbook:
            entries = workbook.infolist()
            if any(_is_unsafe_zip_entry(entry.filename) for entry in entries):
                raise TransformacionExcelSecurityError(
                    "UNSAFE_XLSX_ENTRY",
                    "El archivo XLSX contiene una entrada insegura.",
                )

            total_uncompressed = sum(entry.file_size for entry in entries)
            max_uncompressed = (
                settings.transformacion_excel_max_xlsx_uncompressed_mb
                * 1024
                * 1024
            )
            if total_uncompressed > max_uncompressed:
                raise TransformacionExcelSecurityError(
                    "XLSX_UNCOMPRESSED_SIZE_LIMIT",
                    "El contenido descomprimido del XLSX supera el límite permitido.",
                    413,
                )

            total_compressed = sum(entry.compress_size for entry in entries)
            if total_uncompressed >= SIGNIFICANT_XLSX_UNCOMPRESSED_BYTES:
                ratio = (
                    float("inf")
                    if total_compressed == 0
                    else total_uncompressed / total_compressed
                )
                if ratio > settings.transformacion_excel_max_xlsx_compression_ratio:
                    raise TransformacionExcelSecurityError(
                        "XLSX_COMPRESSION_RATIO_LIMIT",
                        "La relación de compresión del XLSX supera el límite permitido.",
                        413,
                    )

            try:
                workbook_xml = workbook.read("xl/workbook.xml")
                workbook_root = ElementTree.fromstring(workbook_xml)
            except (KeyError, ElementTree.ParseError) as exc:
                raise TransformacionExcelSecurityError(
                    "INVALID_XLSX_CONTAINER",
                    "El archivo XLSX no tiene una estructura válida.",
                ) from exc
            sheet_count = sum(
                1
                for element in workbook_root.iter()
                if element.tag.rsplit("}", 1)[-1] == "sheet"
            )
            if sheet_count > settings.transformacion_excel_max_sheets:
                raise TransformacionExcelSecurityError(
                    "WORKBOOK_SHEET_LIMIT",
                    "El libro supera la cantidad máxima de hojas permitida.",
                    413,
                )
    except BadZipFile as exc:
        raise TransformacionExcelSecurityError(
            "INVALID_XLSX_CONTAINER",
            "El archivo XLSX no es un contenedor válido.",
        ) from exc
    except OSError as exc:
        raise TransformacionExcelSecurityError(
            "INVALID_XLSX_CONTAINER",
            "El archivo XLSX no pudo ser verificado.",
        ) from exc


def validate_source_file_security(path: Path, extension: str) -> tuple[int, str | None]:
    try:
        if not path.exists() or not path.is_file():
            raise TransformacionExcelSecurityError(
                "SOURCE_FILE_MISSING",
                "El archivo físico fuente no existe.",
                404,
            )
        stat = path.stat()
    except TransformacionExcelSecurityError:
        raise
    except OSError as exc:
        raise TransformacionExcelSecurityError(
            "SOURCE_FILE_MISSING",
            "El archivo físico fuente no está disponible.",
            404,
        ) from exc

    max_bytes = settings.transformacion_excel_max_file_size_mb * 1024 * 1024
    if stat.st_size > max_bytes:
        raise TransformacionExcelSecurityError(
            "SOURCE_FILE_TOO_LARGE",
            "El archivo fuente supera el tamaño máximo permitido.",
            413,
        )
    if extension.casefold() == XLSX_EXTENSION:
        validate_xlsx_container(path)

    modified_at = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
    return stat.st_size, modified_at


def validate_dataframe_dimensions(dataframe: pd.DataFrame) -> None:
    row_count, column_count = dataframe.shape
    if row_count > settings.transformacion_excel_max_rows:
        raise TransformacionExcelSecurityError(
            "SOURCE_ROW_LIMIT_EXCEEDED",
            "El archivo fuente supera la cantidad máxima de filas permitida.",
            413,
        )
    if column_count > settings.transformacion_excel_max_columns:
        raise TransformacionExcelSecurityError(
            "SOURCE_COLUMN_LIMIT_EXCEEDED",
            "El archivo fuente supera la cantidad máxima de columnas permitida.",
            413,
        )


def current_transformacion_limits() -> dict[str, int]:
    return {
        "max_rows": settings.transformacion_excel_max_rows,
        "max_columns": settings.transformacion_excel_max_columns,
        "max_file_size_mb": settings.transformacion_excel_max_file_size_mb,
    }


def sanitize_persisted_error(message: object, fallback: str) -> str:
    if not isinstance(message, str) or not message.strip():
        return fallback[:500]
    normalized = message.strip().splitlines()[0]
    lowered = normalized.casefold()
    if any(
        marker in lowered
        for marker in ("traceback", "database_url", "postgresql://", "postgresql+")
    ):
        return fallback[:500]
    if ":\\" in normalized or normalized.startswith("/"):
        return fallback[:500]
    return normalized[:500]
