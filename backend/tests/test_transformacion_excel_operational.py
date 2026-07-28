from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
from types import SimpleNamespace
import unittest

from app.services.transformacion_excel_operational_service import (
    build_transformacion_operational_summary,
    determine_transformacion_action_required,
    determine_transformacion_capabilities,
    merge_operational_issues,
    sanitize_operational_message,
    validation_issues_from_summary,
)
from app.services.transformacion_excel_trace_service import (
    append_transformacion_trace_event,
    get_transformacion_trace_events,
)


NOW = datetime(2026, 7, 28, 12, 0, tzinfo=timezone.utc)


def execution_config() -> dict:
    return {
        "source": {
            "archivo_id": 10,
            "sheet_name": "Ventas",
            "header_row": 1,
        },
        "output_columns": [
            {
                "operation": "SOURCE",
                "position": 1,
                "output_column": "Cliente",
                "source_column": "cliente",
                "output_type": "text",
            },
        ],
        "rows": {},
        "output": {},
    }


def build_execution(
    *,
    estado: str = "CONFIGURADO",
    transformacion: object | None = None,
    resumen_json: object | None = None,
    error_message: str | None = None,
) -> SimpleNamespace:
    if resumen_json is None:
        resumen_json = {
            "transformacion_excel": (
                {"configuracion": execution_config()}
                if transformacion is None
                else transformacion
            ),
        }
    return SimpleNamespace(
        id=7,
        proceso_id=3,
        proceso=SimpleNamespace(nombre="Transformación de ventas"),
        estado=estado,
        resumen_json=resumen_json,
        error_message=error_message,
        finished_at=None,
        created_at=NOW,
    )


def source_record() -> SimpleNamespace:
    return SimpleNamespace(
        id=10,
        ejecucion_id=7,
        nombre_original="ventas.xlsx",
        extension=".xlsx",
        checksum="source-checksum",
        size_bytes=100,
    )


def output_record() -> SimpleNamespace:
    return SimpleNamespace(
        id=20,
        ejecucion_id=7,
        nombre_original="resultado.xlsx",
        extension=".xlsx",
        checksum="output-checksum",
        size_bytes=200,
    )


def append_event(
    summary: object | None,
    event_type: str = "CONFIGURATION_SAVED",
    *,
    metadata: object | None = None,
    occurred_at: datetime = NOW,
) -> dict:
    return append_transformacion_trace_event(
        summary,
        event_type=event_type,
        level="INFO",
        message="Evento operativo",
        actor_user_id=5,
        from_state="CARGADO",
        to_state="CONFIGURADO",
        metadata=metadata,
        occurred_at=occurred_at,
    )


class TransformacionExcelTraceTests(unittest.TestCase):
    def test_01_append_does_not_modify_original_summary(self) -> None:
        original = {"transformacion_excel": {"configuracion": {"a": 1}}}
        snapshot = deepcopy(original)
        append_event(original)
        self.assertEqual(original, snapshot)

    def test_02_append_preserves_existing_keys(self) -> None:
        original = {
            "otro_modulo": {"valor": 1},
            "transformacion_excel": {"configuracion": {"a": 1}},
        }
        result = append_event(original)
        self.assertEqual(result["otro_modulo"], {"valor": 1})
        self.assertEqual(
            result["transformacion_excel"]["configuracion"],
            {"a": 1},
        )

    def test_03_append_creates_trace_when_missing(self) -> None:
        result = append_event(None)
        self.assertEqual(
            len(result["transformacion_excel"]["trazabilidad"]),
            1,
        )

    def test_04_append_generates_unique_event_ids(self) -> None:
        result = append_event(None)
        result = append_event(result)
        events = result["transformacion_excel"]["trazabilidad"]
        self.assertNotEqual(events[0]["event_id"], events[1]["event_id"])

    def test_05_occurred_at_is_timezone_aware(self) -> None:
        result = append_event(None, occurred_at=datetime(2026, 7, 28, 12, 0))
        raw = result["transformacion_excel"]["trazabilidad"][0]["occurred_at"]
        parsed = datetime.fromisoformat(raw)
        self.assertIsNotNone(parsed.utcoffset())

    def test_06_trace_keeps_only_latest_200_events(self) -> None:
        result: dict | None = None
        for index in range(205):
            result = append_event(
                result,
                occurred_at=NOW + timedelta(seconds=index),
            )
        events = result["transformacion_excel"]["trazabilidad"]
        self.assertEqual(len(events), 200)
        self.assertEqual(
            events[0]["occurred_at"],
            (NOW + timedelta(seconds=5)).isoformat(),
        )

    def test_07_get_trace_applies_limit(self) -> None:
        result = append_event(None, occurred_at=NOW)
        result = append_event(result, occurred_at=NOW + timedelta(seconds=1))
        result = append_event(result, occurred_at=NOW + timedelta(seconds=2))
        self.assertEqual(len(get_transformacion_trace_events(result, 2)), 2)

    def test_08_get_trace_orders_newest_first(self) -> None:
        result = append_event(None, occurred_at=NOW)
        result = append_event(result, occurred_at=NOW + timedelta(seconds=1))
        events = get_transformacion_trace_events(result, 2)
        self.assertGreater(events[0]["occurred_at"], events[1]["occurred_at"])

    def test_09_metadata_removes_sensitive_keys_and_paths(self) -> None:
        result = append_event(
            None,
            metadata={
                "archivo_id": 1,
                "ruta_storage": "backend/storage/a.xlsx",
                "details": "C:\\secret\\file.xlsx",
                "token": "secret",
            },
        )
        metadata = result["transformacion_excel"]["trazabilidad"][0][
            "metadata"
        ]
        self.assertEqual(metadata["archivo_id"], 1)
        self.assertNotIn("ruta_storage", metadata)
        self.assertNotIn("token", metadata)
        self.assertEqual(metadata["details"], "[REDACTED_PATH]")

    def test_10_historical_summary_without_trace_returns_empty(self) -> None:
        self.assertEqual(
            get_transformacion_trace_events(
                {"transformacion_excel": {"configuracion": {}}},
            ),
            [],
        )

    def test_11_consecutive_generation_reuse_is_deduplicated(self) -> None:
        metadata = {"archivo_id": 20, "checksum": "abc"}
        result = append_event(
            None,
            "GENERATION_REUSED",
            metadata=metadata,
        )
        result = append_event(
            result,
            "GENERATION_REUSED",
            metadata=metadata,
        )
        self.assertEqual(
            len(result["transformacion_excel"]["trazabilidad"]),
            1,
        )


class TransformacionExcelActionTests(unittest.TestCase):
    def action(
        self,
        estado: str,
        *,
        has_configuration: bool = True,
        blocking: bool = False,
        output_record: bool = False,
        output_file: bool = False,
    ) -> str:
        return determine_transformacion_action_required(
            estado,
            has_configuration,
            True,
            not blocking,
            output_record,
            output_file,
            blocking,
        )

    def test_12_without_configuration_requires_configure(self) -> None:
        self.assertEqual(
            self.action("CARGADO", has_configuration=False),
            "CONFIGURE",
        )

    def test_13_configured_requires_validation(self) -> None:
        self.assertEqual(self.action("CONFIGURADO"), "VALIDATE")

    def test_14_blocking_validation_errors_require_fix(self) -> None:
        self.assertEqual(self.action("CONFIGURADO", blocking=True), "FIX_ERRORS")

    def test_15_validated_requires_generation(self) -> None:
        self.assertEqual(self.action("VALIDADO"), "GENERATE")

    def test_16_processing_requires_wait(self) -> None:
        self.assertEqual(self.action("PROCESANDO"), "WAIT")

    def test_17_completed_with_output_requires_download(self) -> None:
        self.assertEqual(
            self.action("COMPLETADO", output_record=True, output_file=True),
            "DOWNLOAD",
        )

    def test_18_completed_without_output_requires_regeneration(self) -> None:
        self.assertEqual(self.action("COMPLETADO"), "REGENERATE")

    def test_19_error_requires_review(self) -> None:
        self.assertEqual(self.action("ERROR"), "REVIEW_ERROR")

    def test_20_closed_terminal_states_require_no_action(self) -> None:
        for estado in ("CANCELADO", "APROBADO", "RECHAZADO"):
            with self.subTest(estado=estado):
                self.assertEqual(self.action(estado), "NONE")


class TransformacionExcelCapabilitiesTests(unittest.TestCase):
    def capabilities(self, estado: str, **overrides: bool) -> dict[str, bool]:
        values = {
            "has_configuration": True,
            "has_blocking_issues": False,
            "source_file_exists": True,
            "output_record_exists": False,
            "output_file_exists": False,
        }
        values.update(overrides)
        return determine_transformacion_capabilities(estado, **values)

    def test_21_can_generate_only_when_validated_without_errors(self) -> None:
        self.assertTrue(self.capabilities("VALIDADO")["can_generate"])
        self.assertFalse(self.capabilities("CONFIGURADO")["can_generate"])
        self.assertFalse(
            self.capabilities(
                "VALIDADO",
                has_blocking_issues=True,
            )["can_generate"],
        )

    def test_22_can_download_requires_physical_output(self) -> None:
        self.assertTrue(
            self.capabilities(
                "COMPLETADO",
                output_record_exists=True,
                output_file_exists=True,
            )["can_download"],
        )
        self.assertFalse(
            self.capabilities(
                "COMPLETADO",
                output_record_exists=True,
            )["can_download"],
        )

    def test_23_completed_execution_cannot_edit_configuration(self) -> None:
        self.assertFalse(
            self.capabilities("COMPLETADO")["can_edit_configuration"],
        )

    def test_24_can_validate_requires_configuration(self) -> None:
        self.assertFalse(
            self.capabilities(
                "CONFIGURADO",
                has_configuration=False,
            )["can_validate"],
        )


class TransformacionExcelOperationalIssueTests(unittest.TestCase):
    def test_25_converts_validation_errors(self) -> None:
        issues = validation_issues_from_summary(
            {
                "errors": [
                    {
                        "code": "INVALID_INTEGER",
                        "message": "Valor inválido",
                        "count": 2,
                        "output_column": "Cantidad",
                        "sample_rows": [{"row": 2}],
                    },
                ],
            },
        )
        self.assertEqual(issues[0]["severity"], "ERROR")
        self.assertEqual(issues[0]["origin"], "VALIDATION")
        self.assertTrue(issues[0]["blocking"])
        self.assertEqual(issues[0]["count"], 2)

    def test_26_converts_validation_warnings(self) -> None:
        issues = validation_issues_from_summary(
            {
                "warnings": [
                    {"code": "ROWS_FILTERED", "message": "Filas filtradas"},
                ],
            },
        )
        self.assertEqual(issues[0]["severity"], "WARNING")
        self.assertFalse(issues[0]["blocking"])

    def test_27_groups_duplicate_issues_and_sums_counts(self) -> None:
        base = {
            "severity": "ERROR",
            "origin": "VALIDATION",
            "code": "INVALID",
            "message": "Inválido",
            "blocking": True,
            "count": 2,
            "output_column": "A",
            "source_column": None,
            "sample_rows": [{"row": 1}],
        }
        second = {**base, "count": 3, "sample_rows": [{"row": 2}]}
        merged = merge_operational_issues([base, second])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].count, 5)
        self.assertEqual(len(merged[0].sample_rows), 2)

    def test_28_issue_samples_are_limited_to_ten(self) -> None:
        issues = validation_issues_from_summary(
            {
                "errors": [
                    {
                        "code": "INVALID",
                        "message": "Inválido",
                        "sample_rows": [{"row": index} for index in range(15)],
                    },
                ],
            },
        )
        self.assertEqual(len(issues[0]["sample_rows"]), 10)

    def test_29_technical_error_message_is_sanitized(self) -> None:
        message = "Falló C:\\secret\\source.xlsx\nTraceback: internal details"
        sanitized = sanitize_operational_message(message)
        self.assertNotIn("C:\\secret", sanitized)
        self.assertNotIn("Traceback", sanitized)
        self.assertLessEqual(len(sanitized), 500)

    def test_30_summary_does_not_expose_storage_paths(self) -> None:
        validation = {
            "valid": False,
            "errors": [
                {
                    "code": "INVALID",
                    "message": "Error",
                    "sample_rows": [
                        {
                            "ruta_storage": "C:\\secret\\file.xlsx",
                            "value": "C:\\secret\\file.xlsx",
                        },
                    ],
                },
            ],
        }
        execution = build_execution(
            transformacion={
                "configuracion": execution_config(),
                "validacion": validation,
            },
        )
        summary = build_transformacion_operational_summary(
            execution,
            source_record=source_record(),
            source_file_exists=True,
        )
        serialized = summary.model_dump_json()
        self.assertNotIn("ruta_storage", serialized)
        self.assertNotIn("C:\\\\secret", serialized)

    def test_31_invalid_persisted_configuration_creates_issue(self) -> None:
        execution = build_execution(transformacion={"configuracion": {}})
        summary = build_transformacion_operational_summary(execution)
        self.assertIn(
            "PERSISTED_CONFIGURATION_INVALID",
            [issue.code for issue in summary.issues],
        )

    def test_32_missing_source_file_creates_issue(self) -> None:
        summary = build_transformacion_operational_summary(build_execution())
        self.assertIn(
            "SOURCE_FILE_RECORD_MISSING",
            [issue.code for issue in summary.issues],
        )

    def test_33_completed_without_output_creates_issue(self) -> None:
        summary = build_transformacion_operational_summary(
            build_execution(estado="COMPLETADO"),
            source_record=source_record(),
            source_file_exists=True,
        )
        self.assertIn(
            "OUTPUT_FILE_RECORD_MISSING",
            [issue.code for issue in summary.issues],
        )

    def test_34_error_and_warning_counts_sum_issue_counts(self) -> None:
        execution = build_execution(
            transformacion={
                "configuracion": execution_config(),
                "validacion": {
                    "valid": False,
                    "errors": [
                        {"code": "E", "message": "Error", "count": 3},
                    ],
                    "warnings": [
                        {"code": "W", "message": "Warning", "count": 2},
                    ],
                },
            },
        )
        summary = build_transformacion_operational_summary(
            execution,
            source_record=source_record(),
            source_file_exists=True,
        )
        self.assertEqual(summary.errors_count, 3)
        self.assertEqual(summary.warnings_count, 2)


class TransformacionExcelOperationalCompatibilityTests(unittest.TestCase):
    def test_35_none_summary_is_supported(self) -> None:
        execution = build_execution()
        execution.resumen_json = None
        summary = build_transformacion_operational_summary(
            execution,
        )
        self.assertFalse(summary.has_configuration)
        self.assertEqual(summary.action_required, "CONFIGURE")

    def test_36_incomplete_historical_summary_is_supported(self) -> None:
        summary = build_transformacion_operational_summary(
            build_execution(resumen_json={"transformacion_excel": {}}),
        )
        self.assertFalse(summary.validation.available)
        self.assertFalse(summary.generation.available)

    def test_37_summary_builder_does_not_modify_resumen_json(self) -> None:
        execution = build_execution()
        original = deepcopy(execution.resumen_json)
        build_transformacion_operational_summary(
            execution,
            source_record=source_record(),
            source_file_exists=True,
        )
        self.assertEqual(execution.resumen_json, original)

    def test_38_trace_events_are_json_serializable(self) -> None:
        result = append_event(
            None,
            metadata={
                "occurred": NOW,
                "amount": 10.5,
                "items": [1, "dos", None],
            },
        )
        serialized = json.dumps(result, allow_nan=False)
        self.assertIn("CONFIGURATION_SAVED", serialized)


if __name__ == "__main__":
    unittest.main()
