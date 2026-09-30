import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.ejecuciones import create_ejecucion, list_ejecuciones
from app.database.base import Base
from app.models import Cliente, EjecucionProceso, Proceso, Usuario
from app.schemas.ejecucion_proceso import EjecucionProcesoCreate


class EjecucionesSecurityTests(unittest.TestCase):
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
                nombre="Transformación A",
                tipo="TRANSFORMACION_EXCEL",
            )
            other_process = Proceso(
                cliente_id=other_client.id,
                nombre="Transformación B",
                tipo="TRANSFORMACION_EXCEL",
            )
            db.add_all([owner, other, owner_process, other_process])
            db.flush()
            db.add_all(
                [
                    EjecucionProceso(
                        proceso_id=owner_process.id,
                        usuario_id=owner.id,
                        estado="CARGADO",
                    ),
                    EjecucionProceso(
                        proceso_id=other_process.id,
                        usuario_id=other.id,
                        estado="COMPLETADO",
                    ),
                ],
            )
            db.commit()
            self.owner_id = owner.id
            self.owner_process_id = owner_process.id
            self.other_process_id = other_process.id

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_listado_solo_devuelve_ejecuciones_del_cliente_actual(self) -> None:
        with self.session_factory() as db:
            owner = db.get(Usuario, self.owner_id)
            executions = list_ejecuciones(
                proceso_id=None,
                estado=None,
                db=db,
                current_user=owner,
            )
            foreign_process_executions = list_ejecuciones(
                proceso_id=self.other_process_id,
                estado=None,
                db=db,
                current_user=owner,
            )

        self.assertEqual(
            [execution.proceso_id for execution in executions],
            [self.owner_process_id],
        )
        self.assertEqual(foreign_process_executions, [])

    def test_no_permite_crear_una_ejecucion_en_un_proceso_ajeno(self) -> None:
        with self.session_factory() as db:
            owner = db.get(Usuario, self.owner_id)

            with self.assertRaises(HTTPException) as context:
                create_ejecucion(
                    EjecucionProcesoCreate(proceso_id=self.other_process_id),
                    db=db,
                    current_user=owner,
                )

        self.assertEqual(context.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
