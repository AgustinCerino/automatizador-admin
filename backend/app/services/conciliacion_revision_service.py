from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import EjecucionProceso, ResultadoConciliacion
from app.schemas.resultado_revision import ResultadoRevisionUpdate


class ConciliacionRevisionError(Exception):
    status_code = 400


class ConciliacionRevisionNotFoundError(ConciliacionRevisionError):
    status_code = 404


def get_ejecucion(db: Session, ejecucion_id: int) -> EjecucionProceso:
    ejecucion = db.execute(
        select(EjecucionProceso).where(EjecucionProceso.id == ejecucion_id),
    ).scalar_one_or_none()
    if ejecucion is None:
        raise ConciliacionRevisionNotFoundError("Ejecución no encontrada")
    return ejecucion


def get_resultado(db: Session, resultado_id: int) -> ResultadoConciliacion:
    resultado = db.execute(
        select(ResultadoConciliacion).where(
            ResultadoConciliacion.id == resultado_id,
        ),
    ).scalar_one_or_none()
    if resultado is None:
        raise ConciliacionRevisionNotFoundError("Resultado no encontrado")
    return resultado


def get_resultados_ejecucion(
    db: Session,
    ejecucion_id: int,
) -> list[ResultadoConciliacion]:
    return list(
        db.execute(
            select(ResultadoConciliacion)
            .where(ResultadoConciliacion.ejecucion_id == ejecucion_id)
            .order_by(ResultadoConciliacion.id),
        ).scalars().all(),
    )


def update_resultado_revision(
    db: Session,
    resultado_id: int,
    revision_in: ResultadoRevisionUpdate,
) -> ResultadoConciliacion:
    resultado = get_resultado(db, resultado_id)
    update_data = revision_in.model_dump(exclude_unset=True)

    if "observacion" in update_data:
        resultado.observacion = update_data["observacion"]
    if update_data.get("requiere_revision") is not None:
        resultado.requiere_revision = update_data["requiere_revision"]

    db.commit()
    db.refresh(resultado)
    return resultado


def build_revision_summary(
    ejecucion: EjecucionProceso,
    resultados: list[ResultadoConciliacion],
) -> dict[str, Any]:
    counts = Counter(resultado.estado_resultado for resultado in resultados)
    pendientes_revision = sum(
        1 for resultado in resultados if resultado.requiere_revision
    )

    return {
        "ejecucion_id": ejecucion.id,
        "estado_ejecucion": ejecucion.estado,
        "total_resultados": len(resultados),
        "pendientes_revision": pendientes_revision,
        "revisados": len(resultados) - pendientes_revision,
        "conciliados": counts["CONCILIADO"],
        "diferencias_importe": counts["DIFERENCIA_IMPORTE"],
        "solo_archivo_a": counts["SOLO_ARCHIVO_A"],
        "solo_archivo_b": counts["SOLO_ARCHIVO_B"],
        "duplicados_archivo_a": counts["DUPLICADO_ARCHIVO_A"],
        "duplicados_archivo_b": counts["DUPLICADO_ARCHIVO_B"],
        "errores_formato": counts["ERROR_FORMATO"],
    }


def get_revision_summary(db: Session, ejecucion_id: int) -> dict[str, Any]:
    ejecucion = get_ejecucion(db, ejecucion_id)
    resultados = get_resultados_ejecucion(db, ejecucion_id)
    return build_revision_summary(ejecucion, resultados)


def approve_execution(db: Session, ejecucion_id: int) -> dict[str, Any]:
    ejecucion = get_ejecucion(db, ejecucion_id)
    resultados = get_resultados_ejecucion(db, ejecucion_id)

    if not resultados:
        raise ConciliacionRevisionError(
            "La ejecución no tiene resultados para aprobar",
        )
    if any(resultado.requiere_revision for resultado in resultados):
        raise ConciliacionRevisionError(
            "Todavía hay resultados pendientes de revisión",
        )

    ejecucion.estado = "APROBADO"
    ejecucion.error_message = None
    db.commit()
    db.refresh(ejecucion)
    return build_revision_summary(ejecucion, resultados)


def reject_execution(
    db: Session,
    ejecucion_id: int,
    motivo: str | None,
    usuario_id: int,
) -> dict[str, Any]:
    ejecucion = get_ejecucion(db, ejecucion_id)
    resultados = get_resultados_ejecucion(db, ejecucion_id)

    resumen_json = dict(ejecucion.resumen_json or {})
    resumen_json["rechazo"] = {
        "motivo": motivo,
        "usuario_id": usuario_id,
    }
    ejecucion.resumen_json = resumen_json
    ejecucion.estado = "RECHAZADO"
    ejecucion.error_message = motivo

    db.commit()
    db.refresh(ejecucion)
    return build_revision_summary(ejecucion, resultados)
