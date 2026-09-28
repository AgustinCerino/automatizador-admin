from concurrent.futures import ThreadPoolExecutor, wait
from threading import Event
import unittest
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import delete
from sqlalchemy.orm import Session, sessionmaker

from app.models import (
    Cliente,
    EjecucionProceso,
    Proceso,
    ResultadoConciliacion,
    Usuario,
)
from app.schemas.resultado_revision import ResultadoRevisionUpdate
from app.services import conciliacion_revision_service as revision_service
from app.services.conciliacion_revision_service import (
    ConciliacionRevisionConflictError,
)
from tests.integration.conftest import create_test_engine


class ConciliacionRevisionConcurrencyIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_test_engine()
        cls.session_factory = sessionmaker(
            bind=cls.engine,
            class_=Session,
            expire_on_commit=False,
        )

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()

    def setUp(self) -> None:
        suffix = uuid4().hex
        with self.session_factory() as db:
            client = Cliente(nombre=f"Cliente concurrencia {suffix}")
            db.add(client)
            db.flush()
            user = Usuario(
                cliente_id=client.id,
                nombre="Operador concurrencia",
                email=f"revision-{suffix}@example.test",
                password_hash="not-used",
                rol="OPERADOR",
                estado="ACTIVO",
            )
            process = Proceso(
                cliente_id=client.id,
                nombre=f"Conciliación concurrencia {suffix}",
                tipo="CONCILIACION_EXCEL",
            )
            db.add_all([user, process])
            db.flush()
            execution = EjecucionProceso(
                proceso_id=process.id,
                usuario_id=user.id,
                estado="REQUIERE_REVISION",
            )
            db.add(execution)
            db.flush()
            result = ResultadoConciliacion(
                ejecucion_id=execution.id,
                estado_resultado="DIFERENCIA_IMPORTE",
                requiere_revision=False,
            )
            db.add(result)
            db.commit()
            self.client_id = client.id
            self.user_id = user.id
            self.process_id = process.id
            self.execution_id = execution.id
            self.result_id = result.id

    def tearDown(self) -> None:
        with self.session_factory() as db:
            db.execute(
                delete(ResultadoConciliacion).where(
                    ResultadoConciliacion.ejecucion_id == self.execution_id,
                ),
            )
            db.execute(
                delete(EjecucionProceso).where(
                    EjecucionProceso.id == self.execution_id,
                ),
            )
            db.execute(delete(Proceso).where(Proceso.id == self.process_id))
            db.execute(delete(Usuario).where(Usuario.id == self.user_id))
            db.execute(delete(Cliente).where(Cliente.id == self.client_id))
            db.commit()

    def test_rejection_serializes_revision_and_revision_observes_terminal_state(
        self,
    ) -> None:
        rejection_holds_lock = Event()
        allow_rejection_to_commit = Event()
        revision_loaded_result = Event()
        real_get_results = revision_service.get_resultados_ejecucion
        real_get_result = revision_service.get_resultado

        def pause_rejection(db: Session, execution_id: int):
            rejection_holds_lock.set()
            if not allow_rejection_to_commit.wait(timeout=5):
                raise AssertionError("La prueba no liberó el rechazo")
            return real_get_results(db, execution_id)

        def signal_revision(db: Session, result_id: int):
            result = real_get_result(db, result_id)
            revision_loaded_result.set()
            return result

        def reject() -> None:
            with self.session_factory() as db:
                revision_service.reject_execution(
                    db,
                    self.execution_id,
                    "Cierre concurrente",
                    self.user_id,
                    self.client_id,
                )

        def revise() -> None:
            with self.session_factory() as db:
                revision_service.update_resultado_revision(
                    db,
                    self.result_id,
                    ResultadoRevisionUpdate(
                        expected_updated_at=None,
                        observacion="No debe persistirse",
                        requiere_revision=False,
                    ),
                    self.client_id,
                )

        with (
            patch.object(
                revision_service,
                "get_resultados_ejecucion",
                side_effect=pause_rejection,
            ),
            patch.object(
                revision_service,
                "get_resultado",
                side_effect=signal_revision,
            ),
            ThreadPoolExecutor(max_workers=2) as executor,
        ):
            rejection_future = executor.submit(reject)
            self.assertTrue(rejection_holds_lock.wait(timeout=5))
            revision_future = executor.submit(revise)
            self.assertTrue(revision_loaded_result.wait(timeout=5))
            completed, _ = wait([revision_future], timeout=0.25)
            self.assertEqual(completed, set())
            allow_rejection_to_commit.set()
            rejection_future.result(timeout=5)
            with self.assertRaises(ConciliacionRevisionConflictError):
                revision_future.result(timeout=5)

        with self.session_factory() as db:
            execution = db.get(EjecucionProceso, self.execution_id)
            result = db.get(ResultadoConciliacion, self.result_id)
            self.assertEqual(execution.estado, "RECHAZADO")
            self.assertEqual(result.observacion, None)
            self.assertIsNone(result.updated_at)

    def test_approval_serializes_competing_rejection(self) -> None:
        approval_holds_lock = Event()
        allow_approval_to_commit = Event()
        real_get_results = revision_service.get_resultados_ejecucion

        def pause_approval(db: Session, execution_id: int):
            approval_holds_lock.set()
            if not allow_approval_to_commit.wait(timeout=5):
                raise AssertionError("La prueba no liberó la aprobación")
            return real_get_results(db, execution_id)

        def approve() -> None:
            with self.session_factory() as db:
                revision_service.approve_execution(
                    db,
                    self.execution_id,
                    self.client_id,
                )

        def reject() -> None:
            with self.session_factory() as db:
                revision_service.reject_execution(
                    db,
                    self.execution_id,
                    "No debe sobrescribir la aprobación",
                    self.user_id,
                    self.client_id,
                )

        with (
            patch.object(
                revision_service,
                "get_resultados_ejecucion",
                side_effect=pause_approval,
            ),
            ThreadPoolExecutor(max_workers=2) as executor,
        ):
            approval_future = executor.submit(approve)
            self.assertTrue(approval_holds_lock.wait(timeout=5))
            rejection_future = executor.submit(reject)
            completed, _ = wait([rejection_future], timeout=0.25)
            self.assertEqual(completed, set())
            allow_approval_to_commit.set()
            approval_future.result(timeout=5)
            with self.assertRaises(ConciliacionRevisionConflictError):
                rejection_future.result(timeout=5)

        with self.session_factory() as db:
            execution = db.get(EjecucionProceso, self.execution_id)
            self.assertEqual(execution.estado, "APROBADO")
            self.assertNotIn("rechazo", execution.resumen_json or {})

    def test_double_approval_is_serialized_and_second_attempt_conflicts(self) -> None:
        first_holds_lock = Event()
        allow_first_to_commit = Event()
        real_get_results = revision_service.get_resultados_ejecucion

        def pause_first(db: Session, execution_id: int):
            first_holds_lock.set()
            if not allow_first_to_commit.wait(timeout=5):
                raise AssertionError("La prueba no liberó la primera aprobación")
            return real_get_results(db, execution_id)

        def approve() -> None:
            with self.session_factory() as db:
                revision_service.approve_execution(
                    db,
                    self.execution_id,
                    self.client_id,
                )

        with (
            patch.object(
                revision_service,
                "get_resultados_ejecucion",
                side_effect=pause_first,
            ),
            ThreadPoolExecutor(max_workers=2) as executor,
        ):
            first_future = executor.submit(approve)
            self.assertTrue(first_holds_lock.wait(timeout=5))
            second_future = executor.submit(approve)
            completed, _ = wait([second_future], timeout=0.25)
            self.assertEqual(completed, set())
            allow_first_to_commit.set()
            first_future.result(timeout=5)
            with self.assertRaises(ConciliacionRevisionConflictError):
                second_future.result(timeout=5)

        with self.session_factory() as db:
            self.assertEqual(
                db.get(EjecucionProceso, self.execution_id).estado,
                "APROBADO",
            )


if __name__ == "__main__":
    unittest.main()
