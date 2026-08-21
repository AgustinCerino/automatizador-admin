import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useGenerateTransformationResult,
  useTransformationResultQuery,
} from "@/features/transformations/api/use-configuration";
import { TransformationGenerationPanel } from "@/features/transformations/components/transformation-generation-panel";
import type { TransformationSummary } from "@/features/transformations/types";

vi.mock("@/features/transformations/api/use-configuration", () => ({
  useGenerateTransformationResult: vi.fn(),
  useTransformationResultQuery: vi.fn(),
}));

const queryMock = vi.mocked(useTransformationResultQuery);
const generateMock = vi.mocked(useGenerateTransformationResult);
const mutateAsync = vi.fn();
const SUMMARY = {
  action_required: "GENERATE", can_download: false, can_edit_configuration: true,
  can_generate: true, can_validate: false, ejecucion_id: 31, errors_count: 0,
  estado_ejecucion: "VALIDADO", generation: { available: false, file_exists: false },
  has_configuration: true, issues: [], proceso_id: 4, proceso_nombre: "Transformación Excel",
  source: null, validation: { available: true }, warnings_count: 0,
} satisfies TransformationSummary;

describe("TransformationGenerationPanel", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    queryMock.mockReturnValue({ data: undefined, isError: false } as never);
    generateMock.mockReturnValue({ data: undefined, isError: false, isPending: false, mutateAsync } as never);
  });

  it("habilita generar sólo con una validación vigente", () => {
    render(<TransformationGenerationPanel isDirty={false} summary={SUMMARY} validationIsValid />);
    expect(screen.getByRole("button", { name: /generar archivo/i })).toBeEnabled();
  });

  it("respects the current capability reported by the summary", () => {
    render(
      <TransformationGenerationPanel
        isDirty={false}
        summary={{ ...SUMMARY, can_generate: false }}
        validationIsValid
      />,
    );
    expect(screen.getByRole("button", { name: /generar archivo/i })).toBeDisabled();
  });

  it("bloquea la generación y marca el resultado como stale ante cambios", () => {
    render(<TransformationGenerationPanel isDirty summary={{ ...SUMMARY, generation: { available: true, file_exists: true } }} validationIsValid />);
    expect(screen.getByText(/resultado desactualizado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generar archivo/i })).not.toBeInTheDocument();
  });

  it("evita solicitudes duplicadas mientras genera", () => {
    generateMock.mockReturnValue({ data: undefined, isError: false, isPending: true, mutateAsync } as never);
    render(<TransformationGenerationPanel isDirty={false} summary={SUMMARY} validationIsValid />);
    expect(screen.getByRole("button", { name: /generando/i })).toBeDisabled();
  });

  it("recupera un resultado existente y ofrece descargar", () => {
    queryMock.mockReturnValue({ data: { archivo_id: 9, checksum: "a", columnas_salida: ["Monto"], ejecucion_id: 31, estado_ejecucion: "COMPLETADO", extension: ".xlsx", generated_at: "2026-08-12T12:00:00Z", mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nombre_archivo: "resultado.xlsx", reused: true, size_bytes: 1, total_filas: 1 }, isError: false } as never);
    render(<TransformationGenerationPanel isDirty={false} summary={{ ...SUMMARY, estado_ejecucion: "COMPLETADO", generation: { available: true, file_exists: true } }} validationIsValid={false} />);
    expect(screen.getByText("resultado.xlsx")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /descargar xlsx/i })).toBeEnabled();
  });
});
