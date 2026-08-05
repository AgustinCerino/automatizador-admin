from dataclasses import dataclass
from pathlib import Path
import shutil
from uuid import uuid4

from fastapi import UploadFile

from app.services.transformacion_excel_security_service import (
    calculate_file_sha256,
)


ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv", ".pdf"}
STORAGE_ROOT = Path(__file__).resolve().parents[2] / "storage"


@dataclass(frozen=True)
class StoredFile:
    path: Path
    relative_path: str
    checksum: str
    size_bytes: int


def ensure_storage_dir(ejecucion_id: int) -> Path:
    storage_dir = STORAGE_ROOT / "originals" / str(ejecucion_id)
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def get_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def validate_extension(extension: str) -> None:
    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ValueError(f"Extensión no permitida. Permitidas: {allowed}")


def generate_safe_filename(original_filename: str) -> str:
    extension = get_extension(original_filename)
    safe_stem = Path(original_filename).stem.strip().replace(" ", "_")
    if not safe_stem:
        safe_stem = "archivo"
    return f"{safe_stem}_{uuid4().hex}{extension}"


def calculate_sha256(path: Path) -> str:
    return calculate_file_sha256(path)


def save_upload_file(upload_file: UploadFile, ejecucion_id: int) -> StoredFile:
    original_filename = upload_file.filename or "archivo"
    extension = get_extension(original_filename)
    validate_extension(extension)

    storage_dir = ensure_storage_dir(ejecucion_id)
    safe_filename = generate_safe_filename(original_filename)
    destination = storage_dir / safe_filename

    with destination.open("wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    checksum = calculate_sha256(destination)
    size_bytes = destination.stat().st_size
    relative_path = destination.relative_to(STORAGE_ROOT.parent).as_posix()

    return StoredFile(
        path=destination,
        relative_path=relative_path,
        checksum=checksum,
        size_bytes=size_bytes,
    )
