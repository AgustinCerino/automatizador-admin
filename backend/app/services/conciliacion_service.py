from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Archivo, EjecucionProceso, ResultadoConciliacion
from app.services.conciliacion_mapping_service import (
    ConciliacionMappingError,
    ConciliacionMappingNotFoundError,
    ConciliacionResourceNotFoundError,
)
from app.services.file_preview_service import (
    FilePreviewError,
    StoredFileNotFoundError,
    read_file_dataframe,
    resolve_storage_path,
    serialize_value,
    validate_preview_extension,
)


RESULT_STATES = (
    "CONCILIADO",
    "DIFERENCIA_IMPORTE",
    "SOLO_ARCHIVO_A",
    "SOLO_ARCHIVO_B",
    "DUPLICADO_ARCHIVO_A",
    "DUPLICADO_ARCHIVO_B",
    "ERROR_FORMATO",
)


def get_execution(db: Session, ejecucion_id: int) -> EjecucionProceso:
    ejecucion = db.execute(
        select(EjecucionProceso).where(EjecucionProceso.id == ejecucion_id),
    ).scalar_one_or_none()
    if ejecucion is None:
        raise ConciliacionResourceNotFoundError("Ejecución no encontrada")
    return ejecucion


def get_mapped_file(db: Session, archivo_id: int, ejecucion_id: int) -> Archivo:
    archivo = db.execute(
        select(Archivo).where(Archivo.id == archivo_id),
    ).scalar_one_or_none()
    if archivo is None:
        raise ConciliacionResourceNotFoundError(
            f"Archivo no encontrado: {archivo_id}",
        )
    if archivo.ejecucion_id != ejecucion_id:
        raise ConciliacionMappingError(
            f"El archivo {archivo_id} no pertenece a la ejecución indicada",
        )
    return archivo


def load_dataframe(archivo: Archivo) -> pd.DataFrame:
    extension = validate_preview_extension(archivo.extension)
    path = resolve_storage_path(archivo.ruta_storage)
    if not path.exists() or not path.is_file():
        raise StoredFileNotFoundError(
            f"El archivo físico no existe: {archivo.nombre_original}",
        )
    return read_file_dataframe(path, extension)


def clean_key(value: Any) -> str | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    key = str(value).strip()
    return key or None


def parse_amount(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(value, str):
        normalized = value.strip().replace(" ", "")
        if not normalized:
            return None
        if "," in normalized and "." in normalized:
            if normalized.rfind(",") > normalized.rfind("."):
                normalized = normalized.replace(".", "").replace(",", ".")
            else:
                normalized = normalized.replace(",", "")
        elif "," in normalized:
            normalized = normalized.replace(",", ".")
    else:
        normalized = str(value)

    try:
        amount = Decimal(normalized)
    except (InvalidOperation, ValueError):
        return None
    if not amount.is_finite():
        return None
    return amount


def serialize_record(record: dict[str, Any]) -> dict[str, Any]:
    return {str(key): serialize_value(value) for key, value in record.items()}


def normalize_rows(
    df: pd.DataFrame,
    key_column: str,
    amount_column: str,
    source: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    valid_rows: list[dict[str, Any]] = []
    error_results: list[dict[str, Any]] = []

    for record in df.to_dict(orient="records"):
        serialized = serialize_record(record)
        key = clean_key(record.get(key_column))
        amount = parse_amount(record.get(amount_column))

        if key is None or amount is None:
            error_results.append(
                make_result(
                    key=key,
                    state="ERROR_FORMATO",
                    row_a=serialized if source == "A" else None,
                    row_b=serialized if source == "B" else None,
                    observation=(
                        f"Fila inválida en archivo {source}: "
                        "clave vacía o importe inválido"
                    ),
                ),
            )
            continue

        valid_rows.append(
            {
                "key": key,
                "amount": amount,
                "data": serialized,
            },
        )

    return valid_rows, error_results


def make_result(
    key: str | None,
    state: str,
    row_a: dict[str, Any] | None = None,
    row_b: dict[str, Any] | None = None,
    difference: Decimal | None = None,
    observation: str | None = None,
) -> dict[str, Any]:
    return {
        "clave_referencia": key,
        "estado_resultado": state,
        "datos_archivo_a_json": row_a,
        "datos_archivo_b_json": row_b,
        "diferencia_importe": difference,
        "requiere_revision": state != "CONCILIADO",
        "observacion": observation,
    }


def split_duplicates(
    rows: list[dict[str, Any]],
    source: str,
    detect_duplicates: bool,
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]], set[str]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row["key"]].append(row)

    unique_rows: dict[str, dict[str, Any]] = {}
    duplicate_results: list[dict[str, Any]] = []
    duplicate_keys: set[str] = set()

    for key, key_rows in grouped.items():
        if detect_duplicates and len(key_rows) > 1:
            duplicate_keys.add(key)
            for row in key_rows:
                duplicate_results.append(
                    make_result(
                        key=key,
                        state=f"DUPLICADO_ARCHIVO_{source}",
                        row_a=row["data"] if source == "A" else None,
                        row_b=row["data"] if source == "B" else None,
                        observation=f"Clave duplicada en archivo {source}",
                    ),
                )
        else:
            unique_rows[key] = key_rows[0]

    return unique_rows, duplicate_results, duplicate_keys


def reconcile_dataframes(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    mapping: dict[str, Any],
) -> list[dict[str, Any]]:
    rows_a, errors_a = normalize_rows(
        df_a,
        mapping["columna_clave_archivo_a"],
        mapping["columna_importe_archivo_a"],
        "A",
    )
    rows_b, errors_b = normalize_rows(
        df_b,
        mapping["columna_clave_archivo_b"],
        mapping["columna_importe_archivo_b"],
        "B",
    )

    detect_duplicates = bool(mapping.get("detectar_duplicados", True))
    indexed_a, duplicates_a, duplicate_keys_a = split_duplicates(
        rows_a,
        "A",
        detect_duplicates,
    )
    indexed_b, duplicates_b, duplicate_keys_b = split_duplicates(
        rows_b,
        "B",
        detect_duplicates,
    )

    blocked_keys = duplicate_keys_a | duplicate_keys_b
    for key in blocked_keys:
        indexed_a.pop(key, None)
        indexed_b.pop(key, None)

    tolerance = parse_amount(mapping.get("tolerancia_importe", 0)) or Decimal("0")
    results = [*errors_a, *errors_b, *duplicates_a, *duplicates_b]

    for key in sorted(set(indexed_a) | set(indexed_b)):
        row_a = indexed_a.get(key)
        row_b = indexed_b.get(key)

        if row_a is None:
            results.append(
                make_result(
                    key=key,
                    state="SOLO_ARCHIVO_B",
                    row_b=row_b["data"],
                    observation="La clave solo existe en el archivo B",
                ),
            )
            continue
        if row_b is None:
            results.append(
                make_result(
                    key=key,
                    state="SOLO_ARCHIVO_A",
                    row_a=row_a["data"],
                    observation="La clave solo existe en el archivo A",
                ),
            )
            continue

        difference = row_a["amount"] - row_b["amount"]
        state = (
            "CONCILIADO"
            if abs(difference) <= tolerance
            else "DIFERENCIA_IMPORTE"
        )
        results.append(
            make_result(
                key=key,
                state=state,
                row_a=row_a["data"],
                row_b=row_b["data"],
                difference=difference,
                observation=(
                    None
                    if state == "CONCILIADO"
                    else "La diferencia supera la tolerancia configurada"
                ),
            ),
        )

    return results


def build_summary(
    ejecucion_id: int,
    results: list[dict[str, Any]],
    execution_state: str,
) -> dict[str, Any]:
    counts = Counter(result["estado_resultado"] for result in results)
    return {
        "ejecucion_id": ejecucion_id,
        "total_resultados": len(results),
        "conciliados": counts["CONCILIADO"],
        "diferencias_importe": counts["DIFERENCIA_IMPORTE"],
        "solo_archivo_a": counts["SOLO_ARCHIVO_A"],
        "solo_archivo_b": counts["SOLO_ARCHIVO_B"],
        "duplicados_archivo_a": counts["DUPLICADO_ARCHIVO_A"],
        "duplicados_archivo_b": counts["DUPLICADO_ARCHIVO_B"],
        "errores_formato": counts["ERROR_FORMATO"],
        "requiere_revision": sum(
            1 for result in results if result["requiere_revision"]
        ),
        "estado_ejecucion": execution_state,
    }


def execute_reconciliation(db: Session, ejecucion_id: int) -> dict[str, Any]:
    ejecucion = get_execution(db, ejecucion_id)
    mapping = (ejecucion.resumen_json or {}).get("conciliacion_mapping")
    if mapping is None:
        raise ConciliacionMappingNotFoundError(
            "La ejecución no tiene un mapping de conciliación guardado",
        )

    try:
        ejecucion.estado = "PROCESANDO"
        ejecucion.error_message = None
        db.flush()

        archivo_a = get_mapped_file(db, mapping["archivo_a_id"], ejecucion_id)
        archivo_b = get_mapped_file(db, mapping["archivo_b_id"], ejecucion_id)
        df_a = load_dataframe(archivo_a)
        df_b = load_dataframe(archivo_b)

        db.execute(
            delete(ResultadoConciliacion).where(
                ResultadoConciliacion.ejecucion_id == ejecucion_id,
            ),
        )

        results = reconcile_dataframes(df_a, df_b, mapping)
        for result in results:
            db.add(ResultadoConciliacion(ejecucion_id=ejecucion_id, **result))

        requires_review = any(result["requiere_revision"] for result in results)
        ejecucion.estado = "REQUIERE_REVISION" if requires_review else "APROBADO"
        ejecucion.finished_at = datetime.now(timezone.utc)
        summary = build_summary(ejecucion_id, results, ejecucion.estado)
        resumen_json = dict(ejecucion.resumen_json or {})
        resumen_json["conciliacion_resumen"] = summary
        ejecucion.resumen_json = resumen_json

        db.commit()
        return summary
    except Exception as exc:
        db.rollback()
        failed_execution = db.execute(
            select(EjecucionProceso).where(EjecucionProceso.id == ejecucion_id),
        ).scalar_one_or_none()
        if failed_execution is not None:
            failed_execution.estado = "ERROR"
            failed_execution.error_message = str(exc)
            failed_execution.finished_at = datetime.now(timezone.utc)
            db.commit()
        raise


def list_reconciliation_results(
    db: Session,
    ejecucion_id: int,
    estado_resultado: str | None = None,
) -> list[ResultadoConciliacion]:
    get_execution(db, ejecucion_id)
    statement = (
        select(ResultadoConciliacion)
        .where(ResultadoConciliacion.ejecucion_id == ejecucion_id)
        .order_by(ResultadoConciliacion.id)
    )
    if estado_resultado is not None:
        statement = statement.where(
            ResultadoConciliacion.estado_resultado == estado_resultado,
        )
    return list(db.execute(statement).scalars().all())
