from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.conciliaciones import (
    create_or_replace_mapping,
    read_results,
    read_revision_summary,
    update_revision,
)
from app.api.routes.auth import get_current_user
from app.core.security import create_access_token
from app.database.base import Base
from app.models import (
    Archivo,
    Cliente,
    EjecucionProceso,
    Proceso,
    ResultadoConciliacion,
    Usuario,
)
from app.schemas.conciliacion_mapping import ConciliacionMappingCreate
from app.schemas.resultado_revision import ResultadoRevisionUpdate


class ConciliacionRevisionSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(
            bind=self.engine,
            class_=Session,
            expire_on_commit=False,
        )
        self.temp_directory = TemporaryDirectory()

        self._seed_database()

    def tearDown(self) -> None:
        self.engine.dispose()
        self.temp_directory.cleanup()

    def _write_csv(self, filename: str) -> str:
        path = Path(self.temp_directory.name) / filename
        path.write_text("referencia,importe\nFAC-1,100\n", encoding="utf-8")
        return str(path)

    def _seed_database(self) -> None:
        with self.session_factory() as db:
            owner_client = Cliente(nombre="Cliente A")
            other_client = Cliente(nombre="Cliente B")
            db.add_all([owner_client, other_client])
            db.flush()

            owner = Usuario(
                cliente_id=owner_client.id,
                nombre="Operador A",
                email="owner@example.test",
                password_hash="not-used",
                rol="OPERADOR",
                estado="ACTIVO",
            )
            other = Usuario(
                cliente_id=other_client.id,
                nombre="Operador B",
                email="other@example.test",
                password_hash="not-used",
                rol="OPERADOR",
                estado="ACTIVO",
            )
            owner_process = Proceso(
                cliente_id=owner_client.id,
                nombre="Conciliación A",
                tipo="CONCILIACION_EXCEL",
            )
            other_process = Proceso(
                cliente_id=other_client.id,
                nombre="Conciliación B",
                tipo="CONCILIACION_EXCEL",
            )
            db.add_all([owner, other, owner_process, other_process])
            db.flush()

            execution = EjecucionProceso(
                proceso_id=owner_process.id,
                usuario_id=owner.id,
                estado="REQUIERE_REVISION",
                finished_at=datetime(2026, 9, 25, tzinfo=timezone.utc),
            )
            other_execution = EjecucionProceso(
                proceso_id=other_process.id,
                usuario_id=other.id,
                estado="REQUIERE_REVISION",
            )
            db.add_all([execution, other_execution])
            db.flush()

            archivo_a = Archivo(
                ejecucion_id=execution.id,
                tipo_archivo="ENTRADA_CONCILIACION",
                nombre_original="a.csv",
                ruta_storage=self._write_csv("a.csv"),
                extension=".csv",
            )
            archivo_b = Archivo(
                ejecucion_id=execution.id,
                tipo_archivo="ENTRADA_CONCILIACION",
                nombre_original="b.csv",
                ruta_storage=self._write_csv("b.csv"),
                extension=".csv",
            )
            db.add_all([archivo_a, archivo_b])
            db.flush()

            self.mapping = {
                "archivo_a_id": archivo_a.id,
                "archivo_b_id": archivo_b.id,
                "columna_clave_archivo_a": "referencia",
                "columna_clave_archivo_b": "referencia",
                "columna_importe_archivo_a": "importe",
                "columna_importe_archivo_b": "importe",
                "tolerancia_importe": 0.0,
                "detectar_duplicados": True,
                "columnas_archivo_a": ["referencia", "importe"],
                "columnas_archivo_b": ["referencia", "importe"],
            }
            summary = {
                "ejecucion_id": execution.id,
                "total_resultados": 1,
                "conciliados": 0,
                "diferencias_importe": 1,
                "solo_archivo_a": 0,
                "solo_archivo_b": 0,
                "duplicados_archivo_a": 0,
                "duplicados_archivo_b": 0,
                "errores_formato": 0,
                "requiere_revision": 1,
                "estado_ejecucion": "REQUIERE_REVISION",
            }
            execution.resumen_json = {
                "conciliacion_archivos": {
                    "archivo_a_id": archivo_a.id,
                    "archivo_b_id": archivo_b.id,
                },
                "conciliacion_mapping": self.mapping,
                "conciliacion_resumen": summary,
            }
            result = ResultadoConciliacion(
                ejecucion_id=execution.id,
                clave_referencia="FAC-1",
                estado_resultado="DIFERENCIA_IMPORTE",
                datos_archivo_a_json={"referencia": "FAC-1", "importe": 120},
                datos_archivo_b_json={"referencia": "FAC-1", "importe": 100},
                diferencia_importe=20,
                requiere_revision=True,
                observacion="La diferencia supera la tolerancia configurada",
            )
            db.add(result)
            db.commit()

            self.execution_id = execution.id
            self.result_id = result.id
            self.owner_token = create_access_token(data={"sub": str(owner.id)})
            self.other_token = create_access_token(data={"sub": str(other.id)})
            self.owner = owner
            self.other = other

    def _revision_payload(
        self,
        *,
        expected_updated_at: datetime | None = None,
        observacion: str = "Revisado",
    ) -> ResultadoRevisionUpdate:
        return ResultadoRevisionUpdate(
            expected_updated_at=expected_updated_at,
            observacion=observacion,
            requiere_revision=False,
        )

    def test_task38_endpoints_isolate_clients_and_allow_owner(self) -> None:
        with self.session_factory() as db:
            other_user = get_current_user(token=self.other_token, db=db)
            for operation in (
                lambda: read_results(self.execution_id, None, db, other_user),
                lambda: read_revision_summary(self.execution_id, db, other_user),
                lambda: update_revision(
                    self.result_id,
                    self._revision_payload(),
                    db,
                    other_user,
                ),
            ):
                with self.subTest(operation=operation):
                    with self.assertRaises(HTTPException) as context:
                        operation()
                    self.assertEqual(context.exception.status_code, 404)

        with self.session_factory() as db:
            owner_user = get_current_user(token=self.owner_token, db=db)
            results = read_results(self.execution_id, None, db, owner_user)
            self.assertEqual([item.id for item in results], [self.result_id])

            summary = read_revision_summary(self.execution_id, db, owner_user)
            self.assertEqual(summary["pendientes_revision"], 1)

            revision = update_revision(
                self.result_id,
                self._revision_payload(observacion="Validado por el propietario"),
                db,
                owner_user,
            )
            self.assertFalse(revision.requiere_revision)

    def test_mapping_change_invalidates_results_and_persisted_summary(self) -> None:
        changed_mapping = {
            key: value
            for key, value in self.mapping.items()
            if not key.startswith("columnas_archivo_")
        }
        changed_mapping["tolerancia_importe"] = 5.0

        with self.session_factory() as db:
            create_or_replace_mapping(
                self.execution_id,
                ConciliacionMappingCreate(**changed_mapping),
                db,
                self.owner,
            )
            reloaded_results = read_results(
                self.execution_id,
                None,
                db,
                self.owner,
            )
            self.assertEqual(reloaded_results, [])

        with self.session_factory() as db:
            execution = db.get(EjecucionProceso, self.execution_id)
            result_count = db.scalar(
                select(func.count(ResultadoConciliacion.id)).where(
                    ResultadoConciliacion.ejecucion_id == self.execution_id,
                ),
            )
            self.assertEqual(result_count, 0)
            self.assertNotIn("conciliacion_resumen", execution.resumen_json)
            self.assertEqual(
                execution.resumen_json["conciliacion_mapping"]["tolerancia_importe"],
                5.0,
            )
            self.assertEqual(execution.estado, "CARGADO")
            self.assertIsNone(execution.finished_at)

    def test_identical_mapping_preserves_current_results(self) -> None:
        mapping_input = {
            key: value
            for key, value in self.mapping.items()
            if not key.startswith("columnas_archivo_")
        }
        with self.session_factory() as db:
            create_or_replace_mapping(
                self.execution_id,
                ConciliacionMappingCreate(**mapping_input),
                db,
                self.owner,
            )

        with self.session_factory() as db:
            execution = db.get(EjecucionProceso, self.execution_id)
            result_count = db.scalar(
                select(func.count(ResultadoConciliacion.id)).where(
                    ResultadoConciliacion.ejecucion_id == self.execution_id,
                ),
            )
            self.assertEqual(result_count, 1)
            self.assertIn("conciliacion_resumen", execution.resumen_json)
            self.assertEqual(execution.estado, "REQUIERE_REVISION")
            self.assertIsNotNone(execution.finished_at)

    def test_terminal_executions_reject_revision_changes(self) -> None:
        for execution_state in ("APROBADO", "RECHAZADO", "CANCELADO"):
            with self.subTest(execution_state=execution_state):
                with self.session_factory() as db:
                    execution = db.get(EjecucionProceso, self.execution_id)
                    execution.estado = execution_state
                    db.commit()

                with self.session_factory() as db:
                    with self.assertRaises(HTTPException) as context:
                        update_revision(
                            self.result_id,
                            self._revision_payload(observacion=execution_state),
                            db,
                            self.owner,
                        )
                    self.assertEqual(context.exception.status_code, 409)

                with self.session_factory() as db:
                    result = db.get(ResultadoConciliacion, self.result_id)
                    self.assertTrue(result.requiere_revision)
                    self.assertEqual(
                        result.observacion,
                        "La diferencia supera la tolerancia configurada",
                    )

    def test_stale_revision_update_returns_conflict(self) -> None:
        with self.session_factory() as db:
            first_revision = update_revision(
                self.result_id,
                self._revision_payload(observacion="Primera revisión"),
                db,
                self.owner,
            )
            first_updated_at = first_revision.updated_at
            self.assertIsNotNone(first_updated_at)

        with self.session_factory() as db:
            with self.assertRaises(HTTPException) as context:
                update_revision(
                    self.result_id,
                    self._revision_payload(observacion="Sobrescritura obsoleta"),
                    db,
                    self.owner,
                )
            self.assertEqual(context.exception.status_code, 409)

        with self.session_factory() as db:
            fresh_revision = update_revision(
                self.result_id,
                self._revision_payload(
                    expected_updated_at=first_updated_at,
                    observacion="Segunda revisión vigente",
                ),
                db,
                self.owner,
            )
            self.assertEqual(fresh_revision.observacion, "Segunda revisión vigente")


if __name__ == "__main__":
    unittest.main()
