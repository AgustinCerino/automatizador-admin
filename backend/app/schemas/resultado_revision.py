from pydantic import BaseModel, ConfigDict


class ResultadoRevisionUpdate(BaseModel):
    observacion: str | None = None
    requiere_revision: bool | None = None

    model_config = ConfigDict(extra="forbid")


class RechazarEjecucionRequest(BaseModel):
    motivo: str | None = None

    model_config = ConfigDict(extra="forbid")


class RevisionResumenRead(BaseModel):
    ejecucion_id: int
    estado_ejecucion: str
    total_resultados: int
    pendientes_revision: int
    revisados: int
    conciliados: int
    diferencias_importe: int
    solo_archivo_a: int
    solo_archivo_b: int
    duplicados_archivo_a: int
    duplicados_archivo_b: int
    errores_formato: int
