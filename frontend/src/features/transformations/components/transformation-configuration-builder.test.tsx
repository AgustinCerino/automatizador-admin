import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useSaveTransformationConfiguration,
  useTransformationConfigurationQuery,
  useValidateTransformationConfiguration,
} from "@/features/transformations/api/use-configuration";
import { useTransformationSourceStructureQuery } from "@/features/transformations/api/use-source-files";
import { TransformationConfigurationBuilder } from "@/features/transformations/components/transformation-configuration-builder";
import type { TransformationSummary } from "@/features/transformations/types";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("sourceFileId=8&sheet=Datos&headerRow=2"),
}));
vi.mock("@/features/transformations/api/use-configuration", () => ({
  useSaveTransformationConfiguration: vi.fn(),
  useTransformationConfigurationQuery: vi.fn(),
  useValidateTransformationConfiguration: vi.fn(),
}));
vi.mock("@/features/transformations/api/use-source-files", () => ({
  useTransformationSourceStructureQuery: vi.fn(),
}));
vi.mock("@/features/transformations/components/transformation-validation-panel", () => ({
  TransformationValidationPanel: () => null,
}));
vi.mock("@/features/transformations/components/transformation-generation-panel", () => ({
  TransformationGenerationPanel: () => null,
}));

const configurationQueryMock = vi.mocked(useTransformationConfigurationQuery);
const saveMock = vi.mocked(useSaveTransformationConfiguration);
const validateMock = vi.mocked(useValidateTransformationConfiguration);
const structureQueryMock = vi.mocked(useTransformationSourceStructureQuery);
const mutateAsync = vi.fn();

const SUMMARY = {
  action_required: "CONFIGURE",
  can_download: false,
  can_edit_configuration: true,
  can_generate: false,
  can_validate: false,
  ejecucion_id: 31,
  errors_count: 0,
  estado_ejecucion: "CARGADO",
  generation: { available: false, file_exists: false },
  has_configuration: false,
  issues: [],
  proceso_id: 4,
  proceso_nombre: "Transformación Excel",
  source: null,
  validation: { available: false },
  warnings_count: 0,
} satisfies TransformationSummary;

describe("TransformationConfigurationBuilder", { timeout: 15_000 }, () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => undefined;
  });
  beforeEach(() => {
    mutateAsync.mockReset();
    configurationQueryMock.mockReturnValue({ isPending: false } as never);
    saveMock.mockReturnValue({ isError: false, isPending: false, isSuccess: false, mutateAsync } as never);
    validateMock.mockReturnValue({ isError: false, isPending: false, mutateAsync: vi.fn() } as never);
    structureQueryMock.mockReturnValue({
      data: { columns: [{ name: "Importe" }, { name: "Cliente" }] },
      isPending: false,
    } as never);
  });

  it("agrega y elimina columnas del draft", async () => {
    const user = userEvent.setup();
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);

    expect(screen.getByText("Columna 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /agregar columna/i }));
    expect(screen.getByText("Columna 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Eliminar columna 2" }));
    expect(screen.queryByText("Columna 2")).not.toBeInTheDocument();
  });

  it("serializa SOURCE usando una columna inspeccionada", async () => {
    const user = userEvent.setup();
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);

    await user.type(screen.getByLabelText("Nombre de salida"), "Monto");
    await user.click(screen.getByRole("combobox", { name: "Columna de origen" }));
    await user.click(screen.getByRole("option", { name: "Importe" }));
    await user.click(screen.getByRole("button", { name: /guardar configuraci/i }));

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      output_columns: [expect.objectContaining({
        operation: "SOURCE",
        output_column: "Monto",
        source_column: "Importe",
      })],
      source: { archivo_id: 8, header_row: 2, sheet_name: "Datos" },
    }));
  });

  it("cambia a CONSTANT y no conserva la columna de origen", async () => {
    const user = userEvent.setup();
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);

    await user.type(screen.getByLabelText("Nombre de salida"), "País");
    await user.click(screen.getByRole("combobox", { name: /operaci/i }));
    await user.click(screen.getByRole("option", { name: "CONSTANT" }));
    await user.type(screen.getByLabelText("Valor constante"), "Argentina");
    await user.click(screen.getByRole("button", { name: /guardar configuraci/i }));

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      output_columns: [expect.objectContaining({ operation: "CONSTANT", value: "Argentina" })],
    }));
    expect(mutateAsync.mock.calls[0][0].output_columns[0]).not.toHaveProperty("source_column");
  });

  it("muestra validacion inmediata y permite una configuracion avanzada", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TransformationConfigurationBuilder summary={SUMMARY} />);
    await user.click(screen.getByRole("button", { name: /guardar configuraci/i }));
    expect(screen.getByText(/Complet/)).toBeInTheDocument();

    configurationQueryMock.mockReturnValue({
      data: { configuracion: { output_columns: [{ operation: "CONCAT" }] }, ejecucion_id: 31 },
      isPending: false,
    } as never);
    rerender(<TransformationConfigurationBuilder summary={{ ...SUMMARY, has_configuration: true }} />);
    expect(screen.getByRole("button", { name: /guardar configuraci/i })).toBeInTheDocument();
  });

  it("preserves an unsaved draft when the configuration query refetches", async () => {
    const persisted = {
      output_columns: [{ operation: "CONSTANT", output_column: "Estado", value: "Inicial" }],
      rows: { filters: [], remove_duplicates: { enabled: false, by_output_columns: [] }, sort_by: [] },
      source: { archivo_id: 8, header_row: 2, sheet_name: "Datos" },
    };
    configurationQueryMock.mockReturnValue({
      data: { configuracion: persisted, ejecucion_id: 31 },
      isPending: false,
      isSuccess: true,
    } as never);
    const { rerender } = render(
      <TransformationConfigurationBuilder summary={{ ...SUMMARY, has_configuration: true }} />,
    );

    await waitFor(() => expect(screen.getByLabelText("Nombre de salida")).toHaveValue("Estado"));
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Nombre de salida"));
    await user.type(screen.getByLabelText("Nombre de salida"), "Estado local");
    configurationQueryMock.mockReturnValue({
      data: { configuracion: { ...persisted }, ejecucion_id: 31 },
      isPending: false,
      isSuccess: true,
    } as never);
    rerender(<TransformationConfigurationBuilder summary={{ ...SUMMARY, has_configuration: true }} />);

    expect(screen.getByLabelText("Nombre de salida")).toHaveValue("Estado local");
  });

  it("serializes CONCAT parts", async () => {
    const user = userEvent.setup();
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);
    await user.type(screen.getByLabelText("Nombre de salida"), "Referencia");
    await user.click(screen.getByRole("combobox", { name: /operaci/i }));
    await user.click(screen.getByRole("option", { name: "CONCAT" }));
    await user.click(screen.getByRole("button", { name: /agregar parte/i }));
    await user.click(screen.getByRole("combobox", { name: "Columna de parte 1" }));
    await user.click(screen.getByRole("option", { name: "Cliente" }));
    await user.click(screen.getByRole("button", { name: /agregar parte/i }));
    await user.click(screen.getByRole("combobox", { name: "Tipo de parte 2" }));
    await user.click(screen.getByRole("option", { name: "LITERAL" }));
    await user.type(screen.getByRole("textbox", { name: "Literal de parte 2" }), " - ");
    await user.click(screen.getByRole("button", { name: /guardar configuraci/i }));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ output_columns: [expect.objectContaining({ operation: "CONCAT", parts: [{ type: "SOURCE", value: "Cliente" }, { type: "LITERAL", value: " - " }] })] }));
  });

  it("serializes arithmetic operands", async () => {
    const user = userEvent.setup();
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);
    await user.type(screen.getByLabelText("Nombre de salida"), "Monto");
    await user.click(screen.getByRole("combobox", { name: /operaci/i }));
    await user.click(screen.getByRole("option", { name: "ARITHMETIC" }));
    await user.click(screen.getByRole("combobox", { name: "Operando izquierdo" }));
    await user.click(screen.getByRole("option", { name: "Importe" }));
    await user.type(screen.getByRole("textbox", { name: "Operando derecho" }), "1.21");
    await user.click(screen.getByRole("button", { name: /guardar configuraci/i }));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ output_columns: [expect.objectContaining({ operation: "ARITHMETIC", left_operand: { type: "SOURCE", value: "Importe" }, right_operand: { type: "CONSTANT", value: 1.21 } })] }));
  });

  it("serializes VALUE_MAP mappings", async () => {
    const user = userEvent.setup();
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);
    await user.type(screen.getByLabelText("Nombre de salida"), "Medio");
    await user.click(screen.getByRole("combobox", { name: /operaci/i }));
    await user.click(screen.getByRole("option", { name: "VALUE_MAP" }));
    await user.click(screen.getByRole("combobox", { name: "Columna de origen" }));
    await user.click(screen.getByRole("option", { name: "Cliente" }));
    await user.click(screen.getByRole("button", { name: /agregar equivalencia/i }));
    await user.type(screen.getByRole("textbox", { name: "Clave de equivalencia 1" }), "Efectivo");
    await user.type(screen.getByRole("textbox", { name: "Valor de equivalencia 1" }), "1");
    await user.click(screen.getByRole("button", { name: /guardar configuraci/i }));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ output_columns: [expect.objectContaining({ operation: "VALUE_MAP", source_column: "Cliente", mapping: { Efectivo: "1" }, unmapped_policy: "ERROR" })] }));
  });

  it("serializes filters, deduplication, and sorting", async () => {
    const user = userEvent.setup();
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);
    await user.type(screen.getByLabelText("Nombre de salida"), "Monto");
    await user.click(screen.getByRole("combobox", { name: "Columna de origen" }));
    await user.click(screen.getByRole("option", { name: "Importe" }));
    await user.click(screen.getByRole("button", { name: /agregar filtro/i }));
    await user.click(screen.getByRole("combobox", { name: "Columna del filtro 1" }));
    await user.click(screen.getByRole("option", { name: "Cliente" }));
    await user.type(screen.getByRole("textbox", { name: "Valor del filtro 1" }), "ACME");
    await user.click(screen.getByRole("checkbox", { name: /eliminar duplicados/i }));
    await user.click(screen.getByRole("checkbox", { name: "Monto" }));
    await user.click(screen.getByRole("button", { name: /agregar ordenamiento/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Columna de ordenamiento 1" }), "Monto");
    await user.click(screen.getByRole("button", { name: /guardar configuraci/i }));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ rows: {
      filters: [{ source_column: "Cliente", operator: "EQUALS", value: "ACME" }],
      remove_duplicates: { enabled: true, by_output_columns: ["Monto"], keep: "FIRST" },
      sort_by: [{ output_column: "Monto", direction: "ASC" }],
    } }));
  });

  it("enforces the filter and sorting limits", async () => {
    const user = userEvent.setup();
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);
    await user.type(screen.getByLabelText("Nombre de salida"), "Monto");
    await user.click(screen.getByRole("combobox", { name: "Columna de origen" }));
    await user.click(screen.getByRole("option", { name: "Importe" }));
    const addFilter = screen.getByRole("button", { name: /agregar filtro/i });
    for (let index = 0; index < 5; index += 1) await user.click(addFilter);
    expect(addFilter).toBeDisabled();
    const addSort = screen.getByRole("button", { name: /agregar ordenamiento/i });
    for (let index = 0; index < 3; index += 1) await user.click(addSort);
    expect(addSort).toBeDisabled();
  });

  it("allows selecting an ordering column with the keyboard-compatible native control", async () => {
    const user = userEvent.setup();
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);
    await user.type(screen.getByLabelText("Nombre de salida"), "Monto");
    await user.click(screen.getByRole("combobox", { name: "Columna de origen" }));
    await user.click(screen.getByRole("option", { name: "Importe" }));
    await user.click(screen.getByRole("button", { name: /agregar ordenamiento/i }));
    const sortColumn = screen.getByRole("combobox", { name: "Columna de ordenamiento 1" });
    await user.selectOptions(sortColumn, "Monto");
    expect(sortColumn).toHaveValue("Monto");
  });

  it("updates ordering options and marks a renamed output column as invalid", async () => {
    const user = userEvent.setup();
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);
    await user.type(screen.getByLabelText("Nombre de salida"), "Monto");
    await user.click(screen.getByRole("combobox", { name: "Columna de origen" }));
    await user.click(screen.getByRole("option", { name: "Importe" }));
    await user.click(screen.getByRole("button", { name: /agregar ordenamiento/i }));
    const sortColumn = screen.getByRole("combobox", { name: "Columna de ordenamiento 1" });
    expect(screen.getByRole("option", { name: "Monto" })).toBeInTheDocument();
    await user.selectOptions(sortColumn, "Monto");
    await user.clear(screen.getByLabelText("Nombre de salida"));
    await user.type(screen.getByLabelText("Nombre de salida"), "Importe total");
    expect(screen.getByRole("option", { name: "Importe total" })).toBeInTheDocument();
    expect(screen.getByText(/ya no est/)).toBeInTheDocument();
  });

  it("explains why sorting is unavailable without a valid output column", () => {
    render(<TransformationConfigurationBuilder summary={SUMMARY} />);
    expect(screen.getByText(/Primero configur/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /agregar ordenamiento/i })).toBeDisabled();
  });
});
