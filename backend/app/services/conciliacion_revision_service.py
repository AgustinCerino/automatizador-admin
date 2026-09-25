from collections import Counter
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import EjecucionProceso, ResultadoConciliacion
from app.schemas.resultado_revision import ResultadoRevisionUpdate
from app.services.conciliacion_archivos_service import (
    ConciliacionArchivosError,
    get_authorized_conciliation_execution,
)


REVISION_EDITABLE_STATE = "REQUIERE_REVISION"


class ConciliacionRevisionError(Exception):
    status_code = 400


class ConciliacionRevisionNotFoundError(ConciliacionRevisionError):
    status_code = 404


class ConciliacionRevisionConflictError(ConciliacionRevisionError):
    status_code = 409


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


def get_ejecucion_for_client(
    db: Session,
    ejecucion_id: int,
    cliente_id: int,
) -> EjecucionProceso:
    try:
        return get_authorized_conciliation_execution(
            db,
            ejecucion_id,
            cliente_id,
            conceal_forbidden=True,
        )
    except ConciliacionArchivosError as exc:
        if exc.status_code == 404:
            raise ConciliacionRevisionNotFoundError(
                "Ejecución no encontrada",
            ) from exc
        raise ConciliacionRevisionError(str(exc)) from exc


def get_resultado_for_client(
    db: Session,
    resultado_id: int,
    cliente_id: int,
) -> tuple[ResultadoConciliacion, EjecucionProceso]:
    resultado = get_resultado(db, resultado_id)
    try:
        ejecucion = get_ejecucion_for_client(
            db,
            resultado.ejecucion_id,
            cliente_id,
        )
    except ConciliacionRevisionNotFoundError as exc:
        raise ConciliacionRevisionNotFoundError("Resultado no encontrado") from exc
    return resultado, ejecucion


def same_revision_version(
    current: datetime | None,
    expected: datetime | None,
) -> bool:
    if current is None or expected is None:
        return current is expected

    def as_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    return as_utc(current) == as_utc(expected)


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
    cliente_id: int,
) -> ResultadoConciliacion:
    resultado, ejecucion = get_resultado_for_client(db, resultado_id, cliente_id)
    if ejecucion.estado != REVISION_EDITABLE_STATE:
        raise ConciliacionRevisionConflictError(
            "La ejecución ya no admite cambios de revisión",
        )
    if not same_revision_version(
        resultado.updated_at,
        revision_in.expected_updated_at,
    ):
        raise ConciliacionRevisionConflictError(
            "El resultado fue modificado por otro usuario; recargá antes de continuar",
        )

    update_data = revision_in.model_dump(
        exclude={"expected_updated_at"},
        exclude_unset=True,
    )
    values: dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}
    if "observacion" in update_data:
        values["observacion"] = update_data["observacion"]
    if update_data.get("requiere_revision") is not None:
        values["requiere_revision"] = update_data["requiere_revision"]

    statement = update(ResultadoConciliacion).where(
        ResultadoConciliacion.id == resultado_id,
    )
    if resultado.updated_at is None:
        statement = statement.where(ResultadoConciliacion.updated_at.is_(None))
    else:
        statement = statement.where(
            ResultadoConciliacion.updated_at == resultado.updated_at,
        )

    update_result = db.execute(statement.values(**values))
    if update_result.rowcount != 1:
        db.rollback()
        raise ConciliacionRevisionConflictError(
            "El resultado fue modificado por otro usuario; recargá antes de continuar",
        )

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


def get_revision_summary(
    db: Session,
    ejecucion_id: int,
    cliente_id: int,
) -> dict[str, Any]:
    ejecucion = get_ejecucion_for_client(db, ejecucion_id, cliente_id)
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
