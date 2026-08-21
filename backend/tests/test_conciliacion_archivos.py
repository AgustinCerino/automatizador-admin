from collections.abc import Callable
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.conciliaciones import (
    create_or_replace_mapping,
    read_selected_files,
    replace_selected_files,
)
from app.database.base import Base
from app.models import Archivo, Cliente, EjecucionProceso, Proceso, Usuario
from app.schemas.conciliacion_archivos import ConciliacionArchivosSelection
from app.schemas.conciliacion_mapping import ConciliacionMappingCreate


class ConciliacionArchivosApiTests(unittest.TestCase):
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
        path.write_text("referencia,importe\nA-1,10\n", encoding="utf-8")
        return str(path)

    def _seed_database(self) -> None:
        with self.session_factory() as db:
            primary = Cliente(nombre="Principal")
            other = Cliente(nombre="Otro")
            db.add_all([primary, other])
            db.flush()

            user = Usuario(
                cliente_id=primary.id,
                nombre="Operador",
                email="operador@example.test",
                password_hash="not-used",
                rol="OPERADOR",
                estado="ACTIVO",
            )
            other_user = Usuario(
                cliente_id=other.id,
                nombre="Otro operador",
                email="otro@example.test",
                password_hash="not-used",
                rol="OPERADOR",
                estado="ACTIVO",
            )
            conciliation = Proceso(
                cliente_id=primary.id,
                nombre="Conciliar",
                tipo="CONCILIACION_EXCEL",
            )
            transformation = Proceso(
                cliente_id=primary.id,
                nombre="Transformar",
                tipo="TRANSFORMACION_EXCEL",
            )
            other_conciliation = Proceso(
                cliente_id=other.id,
                nombre="Conciliar otro",
                tipo="CONCILIACION_EXCEL",
            )
            db.add_all(
                [
                    user,
                    other_user,
                    conciliation,
                    transformation,
                    other_conciliation,
                ],
            )
            db.flush()

            execution = EjecucionProceso(
                proceso_id=conciliation.id,
                usuario_id=user.id,
                estado="CARGADO",
                resumen_json={"dato_existente": {"preservar": True}},
            )
            transformation_execution = EjecucionProceso(
                proceso_id=transformation.id,
                usuario_id=user.id,
                estado="CARGADO",
            )
            other_execution = EjecucionProceso(
                proceso_id=other_conciliation.id,
                usuario_id=other_user.id,
                estado="CARGADO",
            )
            db.add_all([execution, transformation_execution, other_execution])
            db.flush()

            files = [
                Archivo(
                    ejecucion_id=execution.id,
                    tipo_archivo="ENTRADA",
                    nombre_original="a.csv",
                    ruta_storage=self._write_csv("a.csv"),
                    extension=".csv",
                ),
                Archivo(
                    ejecucion_id=execution.id,
                    tipo_archivo="CUALQUIER_VALOR",
                    nombre_original="b.csv",
                    ruta_storage=self._write_csv("b.csv"),
                    extension=".csv",
                ),
                Archivo(
                    ejecucion_id=execution.id,
                    tipo_archivo="OTRO",
                    nombre_original="c.xls",
                    ruta_storage=self._write_csv("c.csv"),
                    extension=".xls",
                ),
                Archivo(
                    ejecucion_id=execution.id,
                    tipo_archivo="DOCUMENTO",
                    nombre_original="invalido.pdf",
                    ruta_storage=str(Path(self.temp_directory.name) / "invalido.pdf"),
                    extension=".pdf",
                ),
                Archivo(
                    ejecucion_id=transformation_execution.id,
                    tipo_archivo="FUENTE",
                    nombre_original="transformacion.csv",
                    ruta_storage=self._write_csv("transformacion.csv"),
                    extension=".csv",
                ),
                Archivo(
                    ejecucion_id=transformation_execution.id,
                    tipo_archivo="FUENTE",
                    nombre_original="transformacion-2.csv",
                    ruta_storage=self._write_csv("transformacion-2.csv"),
                    extension=".csv",
                ),
                Archivo(
                    ejecucion_id=other_execution.id,
                    tipo_archivo="ENTRADA",
                    nombre_original="otro.csv",
                    ruta_storage=self._write_csv("otro.csv"),
                    extension=".csv",
                ),
            ]
            db.add_all(files)
            db.commit()

            self.current_user = user
            self.other_user = other_user
            self.execution_id = execution.id
            self.transformation_execution_id = transformation_execution.id
            self.other_execution_id = other_execution.id
            self.file_a_id = files[0].id
            self.file_b_id = files[1].id
            self.file_c_id = files[2].id
            self.pdf_file_id = files[3].id
            self.transformation_file_ids = (files[4].id, files[5].id)
            self.other_file_id = files[6].id

    def _selection(self, archivo_a_id: int, archivo_b_id: int) -> dict[str, int]:
        return {
            "archivo_a_id": archivo_a_id,
            "archivo_b_id": archivo_b_id,
        }

    def _mapping(
        self,
        archivo_a_id: int,
        archivo_b_id: int,
    ) -> dict[str, object]:
        return {
            **self._selection(archivo_a_id, archivo_b_id),
            "columna_clave_archivo_a": "referencia",
            "columna_clave_archivo_b": "referencia",
            "columna_importe_archivo_a": "importe",
            "columna_importe_archivo_b": "importe",
            "tolerancia_importe": 0,
            "detectar_duplicados": True,
        }

    def _get_selection(self, execution_id: int | None = None) -> dict:
        with self.session_factory() as db:
            return read_selected_files(
                execution_id or self.execution_id,
                db,
                self.current_user,
            )

    def _put_selection(
        self,
        payload: dict[str, int],
        execution_id: int | None = None,
    ) -> dict:
        with self.session_factory() as db:
            return replace_selected_files(
                execution_id or self.execution_id,
                ConciliacionArchivosSelection(**payload),
                db,
                self.current_user,
            )

    def _post_mapping(
        self,
        payload: dict[str, object],
        execution_id: int | None = None,
    ) -> dict:
        with self.session_factory() as db:
            return create_or_replace_mapping(
                execution_id or self.execution_id,
                ConciliacionMappingCreate(**payload),
                db,
                self.current_user,
            )

    def _assert_http_error(
        self,
        status_code: int,
        action: Callable[[], object],
    ) -> HTTPException:
        with self.assertRaises(HTTPException) as context:
            action()
        self.assertEqual(context.exception.status_code, status_code)
        return context.exception

    def test_selection_persists_changes_and_preserves_summary(self) -> None:
        self._assert_http_error(404, self._get_selection)

        initial = self._selection(self.file_a_id, self.file_b_id)
        self.assertEqual(self._put_selection(initial), initial)

        # Cada request usa una sesión nueva: equivale a reconstruir tras F5.
        self.assertEqual(self._get_selection(), initial)

        changed = self._selection(self.file_c_id, self.file_b_id)
        self.assertEqual(self._put_selection(changed), changed)
        self.assertEqual(self._get_selection(), changed)

        with self.session_factory() as db:
            execution = db.get(EjecucionProceso, self.execution_id)
            self.assertEqual(execution.estado, "CARGADO")
            self.assertEqual(
                execution.resumen_json["dato_existente"],
                {"preservar": True},
            )
            self.assertEqual(
                execution.resumen_json["conciliacion_archivos"],
                changed,
            )

    def test_selection_rejects_invalid_files_execution_and_tenant(self) -> None:
        self._assert_http_error(
            404,
            lambda: self._get_selection(999_999),
        )
        cases = [
            (self._selection(self.file_a_id, self.file_a_id), 400),
            (self._selection(999_999, self.file_b_id), 404),
            (self._selection(self.file_a_id, self.other_file_id), 400),
            (self._selection(self.pdf_file_id, self.file_b_id), 400),
        ]
        for payload, status_code in cases:
            with self.subTest(payload=payload):
                self._assert_http_error(
                    status_code,
                    lambda payload=payload: self._put_selection(payload),
                )

        self._assert_http_error(
            400,
            lambda: self._put_selection(
                self._selection(*self.transformation_file_ids),
                self.transformation_execution_id,
            ),
        )

        self.current_user = self.other_user
        self._assert_http_error(403, self._get_selection)
        self._assert_http_error(
            403,
            lambda: self._put_selection(
                self._selection(self.file_a_id, self.file_b_id),
            ),
        )

    def test_mapping_must_match_explicit_selection(self) -> None:
        selection = self._selection(self.file_a_id, self.file_b_id)
        self.assertEqual(self._put_selection(selection), selection)
        mapping = self._post_mapping(
            self._mapping(self.file_a_id, self.file_b_id),
        )
        self.assertEqual(mapping["archivo_a_id"], self.file_a_id)

        mismatch = self._assert_http_error(
            400,
            lambda: self._post_mapping(
                self._mapping(self.file_c_id, self.file_b_id),
            ),
        )
        self.assertIn("selección persistida", mismatch.detail)

        mismatch = self._assert_http_error(
            400,
            lambda: self._put_selection(
                self._selection(self.file_c_id, self.file_b_id),
            ),
        )
        self.assertIn("mapping existente", mismatch.detail)
        self.assertEqual(self._get_selection(), selection)

    def test_historical_mapping_is_a_read_only_fallback(self) -> None:
        historical_mapping = {
            **self._mapping(self.file_a_id, self.file_b_id),
            "columnas_archivo_a": ["referencia", "importe"],
            "columnas_archivo_b": ["referencia", "importe"],
        }
        with self.session_factory() as db:
            execution = db.get(EjecucionProceso, self.execution_id)
            execution.resumen_json = {
                "dato_existente": {"preservar": True},
                "conciliacion_mapping": historical_mapping,
            }
            db.commit()

        expected = self._selection(self.file_a_id, self.file_b_id)
        self.assertEqual(self._get_selection(), expected)

        with self.session_factory() as db:
            execution = db.get(EjecucionProceso, self.execution_id)
            self.assertNotIn("conciliacion_archivos", execution.resumen_json)

        self.assertEqual(self._put_selection(expected), expected)
        with self.session_factory() as db:
            execution = db.get(EjecucionProceso, self.execution_id)
            self.assertEqual(
                execution.resumen_json["conciliacion_mapping"],
                historical_mapping,
            )
            self.assertEqual(
                execution.resumen_json["conciliacion_archivos"],
                expected,
            )


if __name__ == "__main__":
    unittest.main()
