import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateExecution } from "@/features/executions/api/use-create-execution";
import { NewExecutionDialog } from "@/features/executions/components/new-execution-dialog";
import type { ExecutionRead } from "@/features/executions/types";
import type { ProcessRead } from "@/features/processes/types";
import { ApiError } from "@/lib/api/errors";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerMocks.push }),
}));

vi.mock("@/features/executions/api/use-create-execution", () => ({
  useCreateExecution: vi.fn(),
}));

const useCreateExecutionMock = vi.mocked(useCreateExecution);

const PROCESS = {
  cliente_id: 7,
  created_at: "2026-08-07T12:00:00Z",
  descripcion: null,
  estado: "ACTIVO",
  id: 4,
  nombre: "Transformación Excel",
  tipo: "TRANSFORMACION_EXCEL",
  updated_at: null,
} satisfies ProcessRead;

const EXECUTION = {
  created_at: "2026-08-07T12:00:00Z",
  error_message: null,
  estado: "CARGADO",
  finished_at: null,
  id: 31,
  proceso_id: 4,
  resumen_json: null,
  started_at: "2026-08-07T12:00:00Z",
  usuario_id: 12,
} satisfies ExecutionRead;

function createMutation(overrides: Record<string, unknown> = {}) {
  return {
    error: null,
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue(EXECUTION),
    reset: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useCreateExecution>;
}

describe("NewExecutionDialog", () => {
  beforeEach(() => {
    routerMocks.push.mockReset();
    useCreateExecutionMock.mockReturnValue(createMutation());
  });

  it("abre con el proceso real y permite cancelar", async () => {
    const user = userEvent.setup();
    render(<NewExecutionDialog process={PROCESS} />);

    await user.click(screen.getByRole("button", { name: "Nueva ejecución" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Se creará una nueva ejecución para Transformación Excel.",
    );

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("crea y navega al destino de TRANSFORMACION_EXCEL", async () => {
    const mutation = createMutation();
    useCreateExecutionMock.mockReturnValue(mutation);
    const user = userEvent.setup();
    render(<NewExecutionDialog process={PROCESS} />);

    await user.click(screen.getByRole("button", { name: "Nueva ejecución" }));
    await user.click(screen.getByRole("button", { name: "Crear ejecución" }));

    expect(mutation.mutateAsync).toHaveBeenCalledOnce();
    expect(routerMocks.push).toHaveBeenCalledWith("/transformaciones/31");
  });

  it("muestra el error dentro del diálogo y no lo cierra", async () => {
    const mutation = createMutation({
      error: new ApiError(409, {
        message: "La operación no puede realizarse en el estado actual.",
      }),
      mutateAsync: vi.fn().mockRejectedValue(new Error("falló")),
    });
    useCreateExecutionMock.mockReturnValue(mutation);
    const user = userEvent.setup();
    render(<NewExecutionDialog process={PROCESS} />);

    await user.click(screen.getByRole("button", { name: "Nueva ejecución" }));
    await user.click(screen.getByRole("button", { name: "Crear ejecución" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "La operación no puede realizarse en el estado actual.",
    );
    expect(routerMocks.push).not.toHaveBeenCalled();
  });

  it("deshabilita acciones y muestra Creando durante el submit", async () => {
    const mutation = createMutation();
    useCreateExecutionMock.mockReturnValue(mutation);
    const user = userEvent.setup();
    const view = render(<NewExecutionDialog process={PROCESS} />);

    await user.click(screen.getByRole("button", { name: "Nueva ejecución" }));
    useCreateExecutionMock.mockReturnValue(
      createMutation({ isPending: true }),
    );
    view.rerender(<NewExecutionDialog process={PROCESS} />);

    expect(screen.getByRole("button", { name: "Creando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
