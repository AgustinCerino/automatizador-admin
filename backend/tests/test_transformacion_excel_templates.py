from copy import deepcopy
import unittest

from pydantic import ValidationError

from app.schemas.transformacion_excel import TransformacionExcelConfig
from app.schemas.transformacion_excel_plantilla import (
    TransformacionExcelTemplateConfig,
)
from app.services.transformacion_excel_template_service import (
    TEMPLATE_MODULE,
    TEMPLATE_SCHEMA_VERSION,
    TransformacionExcelTemplateError,
    build_execution_config_from_template,
    build_template_from_execution_config,
    parse_template_config_json,
    serialize_template_config_json,
)


def build_execution_config() -> TransformacionExcelConfig:
    return TransformacionExcelConfig.model_validate(
        {
            "source": {
                "archivo_id": 91,
                "sheet_name": "Ventas",
                "header_row": 2,
            },
            "output_columns": [
                {
                    "operation": "SOURCE",
                    "position": 1,
                    "output_column": "Nombre",
                    "source_column": "cliente",
                    "output_type": "text",
                },
                {
                    "operation": "CONSTANT",
                    "position": 2,
                    "output_column": "Pais",
                    "value": "AR",
                    "output_type": "text",
                },
                {
                    "operation": "CONCAT",
                    "position": 3,
                    "output_column": "Etiqueta",
                    "parts": [
                        {"type": "SOURCE", "value": "cliente"},
                        {"type": "LITERAL", "value": "-"},
                        {"type": "SOURCE", "value": "codigo"},
                    ],
                },
                {
                    "operation": "ARITHMETIC",
                    "position": 4,
                    "output_column": "Total",
                    "operator": "MULTIPLY",
                    "left_operand": {"type": "SOURCE", "value": "cantidad"},
                    "right_operand": {"type": "SOURCE", "value": "precio"},
                    "output_type": "decimal",
                    "decimal_places": 2,
                },
                {
                    "operation": "VALUE_MAP",
                    "position": 5,
                    "output_column": "Estado",
                    "source_column": "estado",
                    "mapping": {"A": "ACTIVO"},
                    "unmapped_policy": "KEEP_ORIGINAL",
                    "output_type": "text",
                },
            ],
            "rows": {
                "filters": [
                    {
                        "source_column": "estado",
                        "operator": "NOT_EMPTY",
                    },
                ],
                "remove_duplicates": {
                    "enabled": True,
                    "by_output_columns": ["Nombre"],
                    "keep": "FIRST",
                },
                "sort_by": [
                    {"output_column": "Total", "direction": "DESC"},
                ],
            },
            "output": {
                "file_name": "ventas_transformadas.xlsx",
                "sheet_name": "Resultado",
                "freeze_header": False,
                "auto_filter": False,
                "auto_width": False,
            },
        },
    )


def build_template() -> TransformacionExcelTemplateConfig:
    return build_template_from_execution_config(build_execution_config())


class TransformacionExcelTemplateTests(unittest.TestCase):
    def test_execution_to_template_removes_archivo_id(self) -> None:
        template = build_template()
        self.assertNotIn("archivo_id", template.source.model_dump())

    def test_execution_to_template_does_not_modify_original(self) -> None:
        config = build_execution_config()
        original = config.model_dump(mode="json")
        build_template_from_execution_config(config)
        self.assertEqual(config.model_dump(mode="json"), original)

    def test_template_preserves_sheet_name_and_header_row(self) -> None:
        template = build_template()
        self.assertEqual(template.source.sheet_name, "Ventas")
        self.assertEqual(template.source.header_row, 2)

    def test_template_preserves_all_five_operations(self) -> None:
        operations = [
            column.operation
            for column in build_template().output_columns
        ]
        self.assertEqual(
            operations,
            ["SOURCE", "CONSTANT", "CONCAT", "ARITHMETIC", "VALUE_MAP"],
        )

    def test_template_preserves_row_rules(self) -> None:
        rows = build_template().rows
        self.assertEqual(rows.filters[0].source_column, "estado")
        self.assertEqual(
            rows.remove_duplicates.by_output_columns,
            ["Nombre"],
        )
        self.assertEqual(rows.sort_by[0].output_column, "Total")

    def test_template_preserves_output_options(self) -> None:
        output = build_template().output
        self.assertEqual(output.file_name, "ventas_transformadas.xlsx")
        self.assertFalse(output.freeze_header)
        self.assertFalse(output.auto_filter)
        self.assertFalse(output.auto_width)

    def test_template_to_execution_adds_archivo_id(self) -> None:
        config = build_execution_config_from_template(build_template(), 123)
        self.assertEqual(config.source.archivo_id, 123)

    def test_sheet_name_override_replaces_template_value(self) -> None:
        config = build_execution_config_from_template(
            build_template(),
            1,
            sheet_name="Nueva hoja",
        )
        self.assertEqual(config.source.sheet_name, "Nueva hoja")

    def test_header_row_override_replaces_template_value(self) -> None:
        config = build_execution_config_from_template(
            build_template(),
            1,
            header_row=7,
        )
        self.assertEqual(config.source.header_row, 7)

    def test_without_overrides_preserves_template_source(self) -> None:
        config = build_execution_config_from_template(build_template(), 1)
        self.assertEqual(config.source.sheet_name, "Ventas")
        self.assertEqual(config.source.header_row, 2)

    def test_template_to_execution_does_not_modify_template(self) -> None:
        template = build_template()
        original = template.model_dump(mode="json")
        build_execution_config_from_template(
            template,
            5,
            sheet_name="Otra",
            header_row=4,
        )
        self.assertEqual(template.model_dump(mode="json"), original)

    def test_template_without_output_columns_is_rejected(self) -> None:
        raw = build_template().model_dump(mode="json")
        raw["output_columns"] = []
        with self.assertRaises(ValidationError):
            TransformacionExcelTemplateConfig.model_validate(raw)

    def test_duplicate_output_names_are_rejected_case_insensitively(self) -> None:
        raw = build_template().model_dump(mode="json")
        duplicate = deepcopy(raw["output_columns"][0])
        duplicate["position"] = 6
        duplicate["output_column"] = " nombre "
        raw["output_columns"].append(duplicate)
        with self.assertRaises(ValidationError):
            TransformacionExcelTemplateConfig.model_validate(raw)

    def test_duplicate_positions_are_rejected(self) -> None:
        raw = build_template().model_dump(mode="json")
        raw["output_columns"][1]["position"] = 1
        with self.assertRaises(ValidationError):
            TransformacionExcelTemplateConfig.model_validate(raw)

    def test_deduplication_requires_existing_output_column(self) -> None:
        raw = build_template().model_dump(mode="json")
        raw["rows"]["remove_duplicates"]["by_output_columns"] = ["Ausente"]
        with self.assertRaises(ValidationError):
            TransformacionExcelTemplateConfig.model_validate(raw)

    def test_sort_requires_existing_output_column(self) -> None:
        raw = build_template().model_dump(mode="json")
        raw["rows"]["sort_by"][0]["output_column"] = "Ausente"
        with self.assertRaises(ValidationError):
            TransformacionExcelTemplateConfig.model_validate(raw)

    def test_serialization_contains_module_and_version(self) -> None:
        stored = serialize_template_config_json(build_template())
        self.assertEqual(stored["modulo"], TEMPLATE_MODULE)
        self.assertEqual(stored["schema_version"], TEMPLATE_SCHEMA_VERSION)

    def test_serialization_does_not_contain_archivo_id(self) -> None:
        stored = serialize_template_config_json(build_template())
        self.assertNotIn("archivo_id", stored["template"]["source"])
        self.assertNotIn("archivo_id", str(stored))

    def test_parser_reconstructs_template(self) -> None:
        template = build_template()
        parsed = parse_template_config_json(
            serialize_template_config_json(template),
        )
        self.assertEqual(parsed, template)

    def test_parser_rejects_other_module(self) -> None:
        stored = serialize_template_config_json(build_template())
        stored["modulo"] = "CONCILIACION"
        with self.assertRaises(TransformacionExcelTemplateError):
            parse_template_config_json(stored)

    def test_parser_rejects_unsupported_schema_version(self) -> None:
        for unsupported_version in (2, True):
            with self.subTest(schema_version=unsupported_version):
                stored = serialize_template_config_json(build_template())
                stored["schema_version"] = unsupported_version
                with self.assertRaises(TransformacionExcelTemplateError):
                    parse_template_config_json(stored)


if __name__ == "__main__":
    unittest.main()
