import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExecutionsTable } from "@/features/executions/components/executions-table";
import type { ExecutionRead } from "@/features/executions/types";

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

describe("ExecutionsTable", () => {
  it("muestra registros, estado y enlace Abrir para Transformación Excel", () => {
    render(
      <ExecutionsTable
        emptyAction={<button>Nueva ejecución</button>}
        executions={[EXECUTION]}
        processType="TRANSFORMACION_EXCEL"
      />,
    );

    expect(screen.getByRole("columnheader", { name: "ID" })).toBeInTheDocument();
    expect(screen.getByText("#31")).toBeInTheDocument();
    expect(screen.getByText("CARGADO")).toHaveAttribute(
      "data-tone",
      "information",
    );
    expect(
      screen.getByRole("link", { name: "Abrir ejecución 31" }),
    ).toHaveAttribute("href", "/transformaciones/31");
  });

  it("abre Conciliación Excel en su workspace específico", () => {
    render(
      <ExecutionsTable
        emptyAction={<button>Nueva ejecución</button>}
        executions={[EXECUTION]}
        processType="CONCILIACION_EXCEL"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Abrir ejecución 31" }),
    ).toHaveAttribute("href", "/conciliaciones/31");
  });

  it("mantiene sin vista los tipos desconocidos", () => {
    render(
      <ExecutionsTable
        emptyAction={<button>Nueva ejecución</button>}
        executions={[EXECUTION]}
        processType="TIPO_DESCONOCIDO"
      />,
    );

    expect(screen.queryByRole("link", { name: /abrir ejecución/i })).not.toBeInTheDocument();
    expect(screen.getByText("Sin vista disponible")).toBeInTheDocument();
  });

  it("muestra el estado vacío con una acción real", () => {
    render(
      <ExecutionsTable
        emptyAction={<button>Nueva ejecución</button>}
        executions={[]}
        processType="TRANSFORMACION_EXCEL"
      />,
    );

    expect(screen.getByText("Todavía no hay ejecuciones.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nueva ejecución" }),
    ).toBeInTheDocument();
  });
});
