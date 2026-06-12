from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict


class ResultadoConciliacionRead(BaseModel):
    id: int
    ejecucion_id: int
    clave_referencia: str | None
    estado_resultado: str
    datos_archivo_a_json: dict[str, Any] | None
    datos_archivo_b_json: dict[str, Any] | None
    diferencia_importe: Decimal | None
    requiere_revision: bool
    observacion: str | None
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class ConciliacionResumenRead(BaseModel):
    ejecucion_id: int
    total_resultados: int
    conciliados: int
    diferencias_importe: int
    solo_archivo_a: int
    solo_archivo_b: int
    duplicados_archivo_a: int
    duplicados_archivo_b: int
    errores_formato: int
    requiere_revision: int
    estado_ejecucion: str
