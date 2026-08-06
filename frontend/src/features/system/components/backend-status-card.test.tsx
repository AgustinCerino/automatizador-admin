import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useHealthQuery,
  type HealthQueryResult,
} from "@/features/system/api/use-health-query";
import { BackendStatusCard } from "@/features/system/components/backend-status-card";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/features/system/api/use-health-query", () => ({
  useHealthQuery: vi.fn(),
}));

const useHealthQueryMock = vi.mocked(useHealthQuery);

function queryResult(
  overrides: Partial<HealthQueryResult> = {},
): HealthQueryResult {
  return {
    data: undefined,
    error: null,
    isError: false,
    isPending: false,
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("BackendStatusCard", () => {
  beforeEach(() => {
    useHealthQueryMock.mockReturnValue(queryResult({ isPending: true }));
  });

  it("muestra un estado de carga accesible", () => {
    render(<BackendStatusCard />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Estado del sistema" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Comprobando conexión con el servidor.",
    );
  });

  it("muestra la conexión exitosa y el estado real recibido", () => {
    useHealthQueryMock.mockReturnValue(
      queryResult({ data: { status: "ok" } }),
    );

    render(<BackendStatusCard />);

    expect(screen.getByText("Servidor conectado")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Estado informado: ok",
    );
  });

  it("no inventa versión, base de datos ni métricas en el estado exitoso", () => {
    useHealthQueryMock.mockReturnValue(
      queryResult({ data: { status: "healthy" } }),
    );

    render(<BackendStatusCard />);

    expect(screen.queryByText(/versión/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/base de datos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/métricas/i)).not.toBeInTheDocument();
  });

  it("muestra el mensaje normalizado de ApiError", () => {
    useHealthQueryMock.mockReturnValue(
      queryResult({
        error: new ApiError(503, {
          code: "BACKEND_UNAVAILABLE",
          message: "El servidor de la aplicación no está disponible.",
        }),
        isError: true,
      }),
    );

    render(<BackendStatusCard />);

    expect(screen.getByText("Servidor no disponible")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "El servidor de la aplicación no está disponible.",
    );
  });

  it("usa un mensaje controlado para un error no normalizado", () => {
    useHealthQueryMock.mockReturnValue(
      queryResult({ error: new TypeError("fetch failed"), isError: true }),
    );

    render(<BackendStatusCard />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo comprobar el estado del servidor.",
    );
    expect(screen.queryByText("fetch failed")).not.toBeInTheDocument();
  });

  it("permite reintentar la comprobación", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    useHealthQueryMock.mockReturnValue(
      queryResult({
        error: new TypeError("fetch failed"),
        isError: true,
        refetch,
      }),
    );

    render(<BackendStatusCard />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(refetch).toHaveBeenCalledOnce();
  });
});
