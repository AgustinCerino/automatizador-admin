import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTransformationTraceQuery } from "@/features/transformations/api/use-transformation-summary-query";
import { TransformationTracePanel } from "@/features/transformations/components/transformation-trace-panel";

vi.mock("@/features/transformations/api/use-transformation-summary-query", () => ({
  useTransformationTraceQuery: vi.fn(),
}));

const useTraceMock = vi.mocked(useTransformationTraceQuery);

describe("TransformationTracePanel", () => {
  beforeEach(() => useTraceMock.mockReset());

  it("muestra un estado de carga propio", () => {
    useTraceMock.mockReturnValue({ isPending: true } as never);
    render(<TransformationTracePanel executionId={31} />);

    expect(screen.getByRole("status", { name: "Cargando historial operativo" })).toBeInTheDocument();
  });

  it("mantiene un error recuperable contenido en el panel", () => {
    const refetch = vi.fn();
    useTraceMock.mockReturnValue({ isError: true, isPending: false, refetch } as never);
    render(<TransformationTracePanel executionId={31} />);

    expect(screen.getByText("El resto del workspace sigue disponible. Podés reintentar esta consulta.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("muestra el estado vacío", () => {
    useTraceMock.mockReturnValue({
      data: { ejecucion_id: 31, items: [], limit: 50, total: 0 },
      isPending: false,
    } as never);
    render(<TransformationTracePanel executionId={31} />);

    expect(screen.getByText("Todavía no hay eventos operativos para esta ejecución.")).toBeInTheDocument();
  });

  it("representa eventos sanitizados sin mostrar metadata ni actor", () => {
    useTraceMock.mockReturnValue({
      data: {
        ejecucion_id: 31,
        items: [{
          actor_user_id: 99,
          event_id: "event-1",
          event_type: "VALIDATION_COMPLETED",
          from_state: "CONFIGURADO",
          level: "WARNING",
          message: "La validación terminó con advertencias.",
          metadata: { storage_path: "/private/result.xlsx" },
          occurred_at: "2026-08-07T12:00:00Z",
          to_state: "VALIDADO",
        }],
        limit: 50,
        total: 1,
      },
      isPending: false,
    } as never);
    render(<TransformationTracePanel executionId={31} />);

    expect(screen.getByText("VALIDATION_COMPLETED")).toBeInTheDocument();
    expect(screen.getByText("La validación terminó con advertencias.")).toBeInTheDocument();
    expect(screen.getByText("Estado: CONFIGURADO → VALIDADO")).toBeInTheDocument();
    expect(screen.queryByText(/private\/result/)).not.toBeInTheDocument();
    expect(screen.queryByText("99")).not.toBeInTheDocument();
  });
});
