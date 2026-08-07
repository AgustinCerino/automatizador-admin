import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTransformationSummaryQuery } from "@/features/transformations/api/use-transformation-summary-query";
import { TransformationWorkspace } from "@/features/transformations/components/transformation-workspace";
import type { TransformationSummary } from "@/features/transformations/types";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/features/transformations/api/use-transformation-summary-query", () => ({
  useTransformationSummaryQuery: vi.fn(),
}));
vi.mock("@/features/transformations/components/source-file-panel", () => ({
  SourceFilePanel: () => <section>Panel de archivo fuente</section>,
}));

const useSummaryMock = vi.mocked(useTransformationSummaryQuery);
const SUMMARY = {
  action_required: "CONFIGURE",
  can_download: false,
  can_edit_configuration: true,
  can_generate: false,
  can_validate: false,
  created_at: "2026-08-07T12:00:00Z",
  ejecucion_id: 31,
  errors_count: 0,
  estado_ejecucion: "CARGADO",
  generation: { available: false, file_exists: false },
  has_configuration: false,
  issues: [],
  proceso_id: 4,
  proceso_nombre: "Transformación mensual",
  source: null,
  validation: { available: false },
  warnings_count: 0,
} satisfies TransformationSummary;

describe("TransformationWorkspace", () => {
  beforeEach(() => {
    useSummaryMock.mockReset();
  });

  it("muestra un skeleton estructural durante la carga", () => {
    useSummaryMock.mockReturnValue({ isPending: true } as never);
    render(<TransformationWorkspace executionId={31} />);
    expect(screen.getByRole("status", { name: "Cargando transformación" })).toBeInTheDocument();
  });

  it("renderiza el resumen real y su contexto", () => {
    useSummaryMock.mockReturnValue({ data: SUMMARY, isPending: false } as never);
    render(<TransformationWorkspace executionId={31} />);
    expect(screen.getByRole("heading", { name: "Transformación Excel" })).toBeInTheDocument();
    expect(screen.getAllByText("Transformación mensual").length).toBeGreaterThan(0);
    expect(screen.getByText("Configurar transformación")).toBeInTheDocument();
    expect(screen.getByText("CARGADO")).toBeInTheDocument();
  });

  it("normaliza el error y ofrece volver al listado seguro", () => {
    useSummaryMock.mockReturnValue({
      error: new ApiError(404, { message: "detalle oculto" }),
      isError: true,
      isPending: false,
    } as never);
    render(<TransformationWorkspace executionId={31} />);
    expect(screen.getByText("No se encontró la ejecución.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a ejecuciones" })).toHaveAttribute(
      "href",
      "/ejecuciones",
    );
  });
});
