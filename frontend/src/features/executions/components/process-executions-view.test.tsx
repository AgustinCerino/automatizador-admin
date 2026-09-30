import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProcessExecutionsQuery } from "@/features/executions/api/use-process-executions-query";
import { ProcessExecutionsView } from "@/features/executions/components/process-executions-view";
import { useProcessQuery } from "@/features/processes/api/use-process-query";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/features/executions/api/use-process-executions-query", () => ({
  useProcessExecutionsQuery: vi.fn(),
}));
vi.mock("@/features/processes/api/use-process-query", () => ({
  useProcessQuery: vi.fn(),
}));
vi.mock("@/features/executions/components/new-execution-dialog", () => ({
  NewExecutionDialog: () => <button>Nueva ejecución</button>,
}));

const useExecutionsMock = vi.mocked(useProcessExecutionsQuery);
const useProcessMock = vi.mocked(useProcessQuery);

const PROCESS = {
  cliente_id: 7,
  created_at: "2026-08-07T12:00:00Z",
  descripcion: "Transformación mensual",
  estado: "ACTIVO",
  id: 4,
  nombre: "Ventas mensuales",
  tipo: "TRANSFORMACION_EXCEL",
  updated_at: null,
};

describe("ProcessExecutionsView", () => {
  beforeEach(() => {
    useProcessMock.mockReset().mockReturnValue({
      data: PROCESS,
      isPending: false,
    } as never);
    useExecutionsMock.mockReset();
  });

  it("muestra un error recuperable y permite reintentar el listado", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    useExecutionsMock.mockReturnValue({
      error: new ApiError(503, { message: "El servidor no está disponible." }),
      isError: true,
      isPending: false,
      refetch,
    } as never);

    render(<ProcessExecutionsView processId={4} />);

    expect(
      screen.getByRole("heading", { name: "No pudimos cargar las ejecuciones." }),
    ).toBeInTheDocument();
    expect(screen.getByText("El servidor no está disponible.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
