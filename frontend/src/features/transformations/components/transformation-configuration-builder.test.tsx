import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useSaveTransformationConfiguration,
  useTransformationConfigurationQuery,
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
}));
vi.mock("@/features/transformations/api/use-source-files", () => ({
  useTransformationSourceStructureQuery: vi.fn(),
}));

const configurationQueryMock = vi.mocked(useTransformationConfigurationQuery);
const saveMock = vi.mocked(useSaveTransformationConfiguration);
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

describe("TransformationConfigurationBuilder", () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => undefined;
  });
  beforeEach(() => {
    mutateAsync.mockReset();
    configurationQueryMock.mockReturnValue({ isPending: false } as never);
    saveMock.mockReturnValue({ isError: false, isPending: false, isSuccess: false, mutateAsync } as never);
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
    await user.click(screen.getByRole("button", { name: /guardar configuración/i }));

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
    await user.click(screen.getByRole("combobox", { name: "Operación de columna 1" }));
    await user.click(screen.getByRole("option", { name: "CONSTANT" }));
    await user.type(screen.getByLabelText("Valor constante"), "Argentina");
    await user.click(screen.getByRole("button", { name: /guardar configuración/i }));

    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      output_columns: [expect.objectContaining({ operation: "CONSTANT", value: "Argentina" })],
    }));
    expect(mutateAsync.mock.calls[0][0].output_columns[0]).not.toHaveProperty("source_column");
  });

  it("muestra validación inmediata y protege una configuración avanzada", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<TransformationConfigurationBuilder summary={SUMMARY} />);
    await user.click(screen.getByRole("button", { name: /guardar configuración/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("Completá el nombre");

    configurationQueryMock.mockReturnValue({
      data: { configuracion: { output_columns: [{ operation: "CONCAT" }] }, ejecucion_id: 31 },
      isPending: false,
    } as never);
    rerender(<TransformationConfigurationBuilder summary={{ ...SUMMARY, has_configuration: true }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Configuración avanzada detectada");
    expect(screen.queryByRole("button", { name: /guardar configuración/i })).not.toBeInTheDocument();
  });
});
