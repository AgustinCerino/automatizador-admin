from datetime import date
from decimal import Decimal
import unittest

import pandas as pd
from pandas.testing import assert_frame_equal

from app.schemas.transformacion_excel import TransformacionExcelConfig
from app.services.transformacion_excel_pipeline import (
    SOURCE_ROW_NUMBER,
    TransformacionPipelineInvalidResultError,
    run_transformacion_pipeline,
)


def build_config(
    output_columns: list[dict],
    *,
    rows: dict | None = None,
    header_row: int = 1,
) -> TransformacionExcelConfig:
    return TransformacionExcelConfig.model_validate(
        {
            "source": {
                "archivo_id": 1,
                "header_row": header_row,
            },
            "output_columns": output_columns,
            "rows": rows or {},
        },
    )


def source_transform(
    source_column: str,
    output_column: str,
    output_type: str = "text",
    *,
    position: int = 1,
    required: bool = False,
    decimal_places: int | None = None,
) -> dict:
    transform = {
        "operation": "SOURCE",
        "position": position,
        "output_column": output_column,
        "source_column": source_column,
        "output_type": output_type,
        "required": required,
    }
    if decimal_places is not None:
        transform["decimal_places"] = decimal_places
    return transform


def issue_by_code(issues: list, code: str):
    return next(issue for issue in issues if issue.code == code)


class TransformacionExcelPipelineTests(unittest.TestCase):
    def test_source_copies_converts_and_orders_by_position(self) -> None:
        config = build_config(
            [
                source_transform(
                    "numero",
                    "Numero",
                    "integer",
                    position=2,
                ),
                source_transform(
                    "nombre",
                    "Nombre",
                    position=1,
                ),
            ],
        )

        result = run_transformacion_pipeline(
            pd.DataFrame([{"nombre": "  Ana  ", "numero": "2.0"}]),
            config,
        )

        self.assertEqual(result.output_columns, ["Nombre", "Numero"])
        self.assertEqual(
            result.final_dataframe.to_dict(orient="records"),
            [{"Nombre": "Ana", "Numero": 2}],
        )

    def test_constant_repeats_configured_value(self) -> None:
        config = build_config(
            [
                {
                    "operation": "CONSTANT",
                    "position": 1,
                    "output_column": "Pais",
                    "value": " AR ",
                    "output_type": "text",
                },
            ],
        )

        result = run_transformacion_pipeline(
            pd.DataFrame({"fila": [1, 2]}),
            config,
        )

        self.assertEqual(result.final_dataframe["Pais"].tolist(), ["AR", "AR"])

    def test_concat_preserves_literals_and_part_order(self) -> None:
        config = build_config(
            [
                {
                    "operation": "CONCAT",
                    "position": 1,
                    "output_column": "Etiqueta",
                    "parts": [
                        {"type": "SOURCE", "value": "nombre"},
                        {"type": "LITERAL", "value": " :: "},
                        {"type": "SOURCE", "value": "codigo"},
                    ],
                },
            ],
        )

        result = run_transformacion_pipeline(
            pd.DataFrame([{"nombre": " Ana ", "codigo": " X "}]),
            config,
        )

        self.assertEqual(
            result.final_dataframe.at[0, "Etiqueta"],
            "Ana :: X",
        )

    def test_arithmetic_add(self) -> None:
        config = self._arithmetic_config("ADD")
        result = run_transformacion_pipeline(
            pd.DataFrame([{"a": 5, "b": 2}]),
            config,
        )
        self.assertEqual(result.final_dataframe.at[0, "Resultado"], Decimal("7.00"))

    def test_arithmetic_multiply_applies_decimal_places(self) -> None:
        config = self._arithmetic_config("MULTIPLY", decimal_places=2)
        result = run_transformacion_pipeline(
            pd.DataFrame([{"a": Decimal("2.345"), "b": 1}]),
            config,
        )
        self.assertEqual(result.final_dataframe.at[0, "Resultado"], Decimal("2.35"))

    def test_arithmetic_divide_detects_zero(self) -> None:
        config = self._arithmetic_config("DIVIDE")
        result = run_transformacion_pipeline(
            pd.DataFrame([{"a": 5, "b": 0}]),
            config,
        )
        self.assertFalse(result.valid)
        self.assertTrue(result.final_dataframe.empty)
        self.assertEqual(issue_by_code(result.errors, "DIVISION_BY_ZERO").count, 1)

    def test_arithmetic_integer_rejects_fractional_result(self) -> None:
        config = self._arithmetic_config("DIVIDE", output_type="integer")
        result = run_transformacion_pipeline(
            pd.DataFrame([{"a": 5, "b": 2}]),
            config,
        )
        self.assertFalse(result.valid)
        self.assertEqual(
            issue_by_code(result.errors, "INVALID_INTEGER_RESULT").count,
            1,
        )

    def test_value_map_matches_casefolded_trimmed_keys(self) -> None:
        config = self._value_map_config("ERROR", mapping={" ok ": 10})
        result = run_transformacion_pipeline(
            pd.DataFrame([{"codigo": " OK "}]),
            config,
        )
        self.assertTrue(result.valid)
        self.assertEqual(result.final_dataframe.at[0, "Mapeado"], 10)

    def test_value_map_error_excludes_row(self) -> None:
        config = self._value_map_config("ERROR")
        result = run_transformacion_pipeline(
            pd.DataFrame([{"codigo": "NO"}]),
            config,
        )
        self.assertFalse(result.valid)
        self.assertTrue(result.final_dataframe.empty)
        self.assertEqual(issue_by_code(result.errors, "UNMAPPED_VALUE").count, 1)

    def test_value_map_keep_original_adds_warning(self) -> None:
        config = self._value_map_config(
            "KEEP_ORIGINAL",
            output_type="text",
        )
        result = run_transformacion_pipeline(
            pd.DataFrame([{"codigo": " NO "}]),
            config,
        )
        self.assertTrue(result.valid)
        self.assertEqual(result.final_dataframe.at[0, "Mapeado"], "NO")
        self.assertEqual(
            issue_by_code(result.warnings, "UNMAPPED_VALUE_KEPT").count,
            1,
        )

    def test_value_map_use_default_adds_warning(self) -> None:
        config = self._value_map_config(
            "USE_DEFAULT",
            default_value=7,
        )
        result = run_transformacion_pipeline(
            pd.DataFrame([{"codigo": "NO"}]),
            config,
        )
        self.assertTrue(result.valid)
        self.assertEqual(result.final_dataframe.at[0, "Mapeado"], 7)
        self.assertEqual(
            issue_by_code(
                result.warnings,
                "UNMAPPED_VALUE_DEFAULTED",
            ).count,
            1,
        )

    def test_filters_are_combined_with_and(self) -> None:
        config = build_config(
            [source_transform("nombre", "Nombre")],
            rows={
                "filters": [
                    {
                        "source_column": "estado",
                        "operator": "EQUALS",
                        "value": " activo ",
                    },
                    {
                        "source_column": "importe",
                        "operator": "GREATER_THAN",
                        "value": 10,
                    },
                ],
            },
        )
        dataframe = pd.DataFrame(
            [
                {"nombre": "A", "estado": "ACTIVO", "importe": 20},
                {"nombre": "B", "estado": "ACTIVO", "importe": 5},
                {"nombre": "C", "estado": "INACTIVO", "importe": 20},
            ],
        )

        result = run_transformacion_pipeline(dataframe, config)

        self.assertEqual(result.final_dataframe["Nombre"].tolist(), ["A"])
        self.assertEqual(result.metrics.filas_excluidas_por_filtros, 2)
        self.assertEqual(
            issue_by_code(result.warnings, "ROWS_FILTERED_OUT").count,
            2,
        )

    def test_invalid_filter_value_is_not_valid_output(self) -> None:
        config = build_config(
            [source_transform("nombre", "Nombre")],
            rows={
                "filters": [
                    {
                        "source_column": "importe",
                        "operator": "LESS_THAN",
                        "value": 10,
                    },
                ],
            },
        )

        result = run_transformacion_pipeline(
            pd.DataFrame(
                [
                    {"nombre": "A", "importe": "inválido"},
                    {"nombre": "B", "importe": 5},
                ],
            ),
            config,
        )

        self.assertFalse(result.valid)
        self.assertEqual(result.final_dataframe["Nombre"].tolist(), ["B"])
        self.assertEqual(
            issue_by_code(result.errors, "INVALID_FILTER_VALUE").count,
            1,
        )

    def test_all_supported_filter_operators(self) -> None:
        cases = [
            (
                {"operator": "EQUALS", "value": " hola "},
                " HOLA ",
                True,
            ),
            (
                {"operator": "IN", "values": ["uno", " DOS "]},
                "dos",
                True,
            ),
            ({"operator": "NOT_EMPTY"}, " x ", True),
            ({"operator": "IS_EMPTY"}, pd.NaT, True),
            ({"operator": "GREATER_THAN", "value": "1,5"}, 2, True),
            ({"operator": "LESS_THAN", "value": 10}, 5, True),
            (
                {"operator": "CONTAINS", "value": " mundo "},
                "Hola MUNDO",
                True,
            ),
        ]
        for rule_data, value, expected in cases:
            with self.subTest(operator=rule_data["operator"]):
                config = build_config(
                    [source_transform("valor", "Valor")],
                    rows={
                        "filters": [
                            {
                                "source_column": "valor",
                                **rule_data,
                            },
                        ],
                    },
                )
                result = run_transformacion_pipeline(
                    pd.DataFrame([{"valor": value}]),
                    config,
                )
                self.assertEqual(len(result.final_dataframe) == 1, expected)

    def test_argentine_decimal_conversion(self) -> None:
        result = self._run_decimal_source("1.234,56")
        self.assertEqual(
            result.final_dataframe.at[0, "Importe"],
            Decimal("1234.56"),
        )

    def test_international_decimal_conversion(self) -> None:
        result = self._run_decimal_source("1,234.56")
        self.assertEqual(
            result.final_dataframe.at[0, "Importe"],
            Decimal("1234.56"),
        )

    def test_date_dd_mm_yyyy(self) -> None:
        result = self._run_date_source("20/07/2026")
        self.assertEqual(
            result.final_dataframe.at[0, "Fecha"],
            date(2026, 7, 20),
        )

    def test_date_iso(self) -> None:
        result = self._run_date_source("2026-07-20")
        self.assertEqual(
            result.final_dataframe.at[0, "Fecha"],
            date(2026, 7, 20),
        )

    def test_required_empty_value(self) -> None:
        config = build_config(
            [
                source_transform(
                    "valor",
                    "Valor",
                    required=True,
                ),
            ],
        )
        result = run_transformacion_pipeline(
            pd.DataFrame([{"valor": "   "}]),
            config,
        )
        self.assertFalse(result.valid)
        self.assertEqual(
            issue_by_code(result.errors, "REQUIRED_VALUE_MISSING").count,
            1,
        )

    def test_conversion_error_does_not_duplicate_required_error(self) -> None:
        config = build_config(
            [
                source_transform(
                    "importe",
                    "Importe",
                    "decimal",
                    required=True,
                ),
            ],
        )
        result = run_transformacion_pipeline(
            pd.DataFrame([{"importe": "inválido"}]),
            config,
        )
        self.assertEqual([issue.code for issue in result.errors], ["INVALID_DECIMAL"])

    def test_deduplication_keeps_first(self) -> None:
        config = build_config(
            [source_transform("codigo", "Codigo")],
            rows={
                "remove_duplicates": {
                    "enabled": True,
                    "by_output_columns": ["codigo"],
                    "keep": "FIRST",
                },
            },
        )

        result = run_transformacion_pipeline(
            pd.DataFrame([{"codigo": "A"}, {"codigo": "A"}, {"codigo": "B"}]),
            config,
        )

        self.assertEqual(result.final_dataframe["Codigo"].tolist(), ["A", "B"])
        self.assertEqual(result.metrics.duplicados_detectados, 1)
        self.assertEqual(result.metrics.duplicados_eliminados, 1)
        warning = issue_by_code(result.warnings, "DUPLICATES_REMOVED")
        self.assertEqual(warning.samples[0]["source_row_number"], 3)

    def test_sorting_respects_multiple_rules(self) -> None:
        config = build_config(
            [
                source_transform("grupo", "Grupo", position=1),
                source_transform(
                    "valor",
                    "Valor",
                    "integer",
                    position=2,
                ),
            ],
            rows={
                "sort_by": [
                    {"output_column": "Grupo", "direction": "ASC"},
                    {"output_column": "Valor", "direction": "DESC"},
                ],
            },
        )
        dataframe = pd.DataFrame(
            [
                {"grupo": "B", "valor": 1},
                {"grupo": "A", "valor": 1},
                {"grupo": "A", "valor": 3},
                {"grupo": "B", "valor": 2},
            ],
        )

        result = run_transformacion_pipeline(dataframe, config)

        self.assertEqual(
            result.final_dataframe.to_dict(orient="records"),
            [
                {"Grupo": "A", "Valor": 3},
                {"Grupo": "A", "Valor": 1},
                {"Grupo": "B", "Valor": 2},
                {"Grupo": "B", "Valor": 1},
            ],
        )

    def test_sorting_puts_nulls_last_for_both_directions(self) -> None:
        for direction, expected in (
            ("ASC", [1, 2, None]),
            ("DESC", [2, 1, None]),
        ):
            with self.subTest(direction=direction):
                config = build_config(
                    [
                        source_transform(
                            "valor",
                            "Valor",
                            "integer",
                        ),
                    ],
                    rows={
                        "sort_by": [
                            {
                                "output_column": "Valor",
                                "direction": direction,
                            },
                        ],
                    },
                )
                result = run_transformacion_pipeline(
                    pd.DataFrame([{"valor": None}, {"valor": 2}, {"valor": 1}]),
                    config,
                )
                self.assertEqual(
                    result.final_dataframe["Valor"].tolist(),
                    expected,
                )

    def test_final_columns_respect_position_only(self) -> None:
        config = build_config(
            [
                source_transform("c", "C", position=3),
                source_transform("a", "A", position=1),
                source_transform("b", "B", position=2),
            ],
        )

        result = run_transformacion_pipeline(
            pd.DataFrame([{"a": "a", "b": "b", "c": "c", "extra": "x"}]),
            config,
        )

        self.assertEqual(list(result.final_dataframe.columns), ["A", "B", "C"])

    def test_source_dataframe_is_not_modified_and_internal_name_does_not_collide(
        self,
    ) -> None:
        dataframe = pd.DataFrame(
            [{SOURCE_ROW_NUMBER: "usuario", "valor": "x"}],
        )
        original = dataframe.copy(deep=True)
        config = build_config(
            [
                source_transform(
                    SOURCE_ROW_NUMBER,
                    "ColumnaUsuario",
                ),
            ],
        )

        result = run_transformacion_pipeline(dataframe, config)

        assert_frame_equal(dataframe, original)
        self.assertEqual(
            result.final_dataframe.at[0, "ColumnaUsuario"],
            "usuario",
        )

    def test_valid_config_without_rows_returns_empty_shaped_dataframe(
        self,
    ) -> None:
        config = build_config(
            [
                source_transform("a", "A", position=1),
                {
                    "operation": "CONSTANT",
                    "position": 2,
                    "output_column": "B",
                    "value": 1,
                    "output_type": "integer",
                },
            ],
        )

        result = run_transformacion_pipeline(
            pd.DataFrame(columns=["a"]),
            config,
        )

        self.assertTrue(result.valid)
        self.assertTrue(result.final_dataframe.empty)
        self.assertEqual(list(result.final_dataframe.columns), ["A", "B"])

    def test_rows_with_conversion_errors_are_excluded(self) -> None:
        config = build_config(
            [source_transform("importe", "Importe", "decimal")],
        )
        result = run_transformacion_pipeline(
            pd.DataFrame([{"importe": "x"}, {"importe": "2,50"}]),
            config,
        )

        self.assertFalse(result.valid)
        self.assertEqual(len(result.final_dataframe), 1)
        self.assertEqual(
            result.final_dataframe.at[0, "Importe"],
            Decimal("2.50"),
        )
        self.assertEqual(result.metrics.filas_con_errores, 1)

    def test_error_samples_are_limited_to_ten(self) -> None:
        config = build_config(
            [source_transform("entero", "Entero", "integer")],
        )
        result = run_transformacion_pipeline(
            pd.DataFrame({"entero": ["x"] * 12}),
            config,
        )

        issue = issue_by_code(result.errors, "INVALID_INTEGER")
        self.assertEqual(issue.count, 12)
        self.assertEqual(len(issue.samples), 10)

    def test_source_row_number_uses_header_row(self) -> None:
        config = build_config(
            [source_transform("valor", "Valor", required=True)],
            header_row=3,
        )
        result = run_transformacion_pipeline(
            pd.DataFrame([{"valor": None}]),
            config,
        )

        issue = issue_by_code(result.errors, "REQUIRED_VALUE_MISSING")
        self.assertEqual(issue.samples[0]["source_row_number"], 4)
        self.assertNotIn(SOURCE_ROW_NUMBER, result.final_dataframe.columns)

    def test_invalid_result_can_block_future_export(self) -> None:
        config = build_config(
            [source_transform("entero", "Entero", "integer")],
        )
        result = run_transformacion_pipeline(
            pd.DataFrame([{"entero": "x"}]),
            config,
        )

        with self.assertRaises(TransformacionPipelineInvalidResultError) as ctx:
            result.raise_if_invalid()
        self.assertIs(ctx.exception.result, result)

    def test_ambiguous_single_separator_decimal_is_rejected(self) -> None:
        result = self._run_decimal_source("1,234")
        self.assertFalse(result.valid)
        self.assertEqual(
            issue_by_code(result.errors, "INVALID_DECIMAL").count,
            1,
        )

    def _arithmetic_config(
        self,
        operator: str,
        *,
        output_type: str = "decimal",
        decimal_places: int = 2,
    ) -> TransformacionExcelConfig:
        return build_config(
            [
                {
                    "operation": "ARITHMETIC",
                    "position": 1,
                    "output_column": "Resultado",
                    "operator": operator,
                    "left_operand": {"type": "SOURCE", "value": "a"},
                    "right_operand": {"type": "SOURCE", "value": "b"},
                    "output_type": output_type,
                    "decimal_places": decimal_places,
                },
            ],
        )

    def _value_map_config(
        self,
        policy: str,
        *,
        mapping: dict | None = None,
        default_value: object = None,
        output_type: str = "integer",
    ) -> TransformacionExcelConfig:
        transform = {
            "operation": "VALUE_MAP",
            "position": 1,
            "output_column": "Mapeado",
            "source_column": "codigo",
            "mapping": mapping or {"SI": 1},
            "unmapped_policy": policy,
            "output_type": output_type,
        }
        if policy == "USE_DEFAULT":
            transform["default_value"] = default_value
        return build_config([transform])

    def _run_decimal_source(self, value: object):
        config = build_config(
            [source_transform("importe", "Importe", "decimal")],
        )
        return run_transformacion_pipeline(
            pd.DataFrame([{"importe": value}]),
            config,
        )

    def _run_date_source(self, value: object):
        config = build_config(
            [source_transform("fecha", "Fecha", "date")],
        )
        return run_transformacion_pipeline(
            pd.DataFrame([{"fecha": value}]),
            config,
        )


if __name__ == "__main__":
    unittest.main()
