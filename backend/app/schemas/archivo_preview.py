from typing import Any

from pydantic import BaseModel, ConfigDict


class ArchivoPreviewRead(BaseModel):
    archivo_id: int
    nombre_original: str
    extension: str | None
    columns: list[str]
    rows: list[dict[str, Any]]
    preview_limit: int
    total_rows: int

    model_config = ConfigDict(from_attributes=True)
