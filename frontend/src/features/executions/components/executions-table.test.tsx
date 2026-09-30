import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExecutionsTable } from "@/features/executions/components/executions-table";
import type { ExecutionRead } from "@/features/executions/types";

vi.mock(
  "@/features/executions/components/transformation-execution-actions",
  () => ({
    TransformationExecutionActions: () => <span>Acciones de descarga</span>,
  }),
);

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

const FILTERABLE_EXECUTIONS = [
  {
    ...EXECUTION,
    estado: "COMPLETADO",
    resumen_json: {
      transformacion_excel: {
        generacion: { nombre_archivo: "ventas-agosto.xlsx", total_filas: 20 },
      },
    },
  },
  {
    ...EXECUTION,
    created_at: "2026-08-09T12:00:00Z",
    error_message: "Archivo inválido",
    estado: "ERROR",
    id: 32,
  },
  {
    ...EXECUTION,
    created_at: "2026-08-08T12:00:00Z",
    estado: "COMPLETADO",
    id: 33,
    resumen_json: {
      transformacion_excel: {
        generacion: { nombre_archivo: "compras-agosto.xlsx", total_filas: 15 },
      },
    },
  },
] satisfies ExecutionRead[];

function renderFilterableHistory() {
  return render(
    <ExecutionsTable
      emptyAction={<button>Nueva ejecución</button>}
      executions={FILTERABLE_EXECUTIONS}
      processType="TRANSFORMACION_EXCEL"
    />,
  );
}

function visibleExecutionIds(): string[] {
  return screen
    .getAllByRole("link", { name: /abrir ejecución/i })
    .map((link) => link.getAttribute("aria-label") ?? "");
}

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
    expect(screen.getByText("CARGADO", { selector: "span" })).toHaveAttribute(
      "data-tone",
      "information",
    );
    expect(
      screen.getByRole("link", { name: "Abrir ejecución 31" }),
    ).toHaveAttribute("href", "/transformaciones/31");
    expect(screen.getByText("Acciones de descarga")).toBeInTheDocument();
  });

  it("distingue estados y muestra resultado, error o pendiente", () => {
    render(
      <ExecutionsTable
        emptyAction={<button>Nueva ejecución</button>}
        executions={[
          {
            ...EXECUTION,
            estado: "COMPLETADO",
            finished_at: "2026-08-07T12:05:00Z",
            resumen_json: {
              transformacion_excel: {
                generacion: {
                  nombre_archivo: "resultado.xlsx",
                  total_filas: 1234,
                },
              },
            },
          },
          {
            ...EXECUTION,
            error_message: "No se pudo procesar el archivo.",
            estado: "ERROR",
            id: 32,
          },
          { ...EXECUTION, estado: "PROCESANDO", id: 33 },
        ]}
        processType="TRANSFORMACION_EXCEL"
      />,
    );

    expect(
      screen.getByText("COMPLETADO", { selector: "span" }),
    ).toHaveAttribute(
      "data-tone",
      "success",
    );
    expect(screen.getByText("ERROR", { selector: "span" })).toHaveAttribute(
      "data-tone",
      "error",
    );
    expect(
      screen.getByText("PROCESANDO", { selector: "span" }),
    ).toHaveAttribute(
      "data-tone",
      "warning",
    );
    expect(screen.getByText("resultado.xlsx")).toBeInTheDocument();
    expect(screen.getByText("1.234 filas")).toBeInTheDocument();
    expect(screen.getByText("No se pudo procesar el archivo.")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
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

  it("busca por nombre de archivo o ID", async () => {
    const user = userEvent.setup();
    renderFilterableHistory();

    const search = screen.getByRole("searchbox", { name: "Buscar" });
    await user.type(search, "compras");
    expect(visibleExecutionIds()).toEqual(["Abrir ejecución 33"]);

    await user.clear(search);
    await user.type(search, "#31");
    expect(visibleExecutionIds()).toEqual(["Abrir ejecución 31"]);
  });

  it("filtra por estado", async () => {
    const user = userEvent.setup();
    renderFilterableHistory();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Estado" }),
      "ERROR",
    );

    expect(visibleExecutionIds()).toEqual(["Abrir ejecución 32"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 resultado visible");
  });

  it("combina búsqueda y estado", async () => {
    const user = userEvent.setup();
    renderFilterableHistory();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Estado" }),
      "COMPLETADO",
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Buscar" }),
      "compras",
    );

    expect(visibleExecutionIds()).toEqual(["Abrir ejecución 33"]);
  });

  it("ordena por fecha con las más recientes primero por defecto", async () => {
    const user = userEvent.setup();
    renderFilterableHistory();

    expect(visibleExecutionIds()).toEqual([
      "Abrir ejecución 32",
      "Abrir ejecución 33",
      "Abrir ejecución 31",
    ]);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Orden" }),
      "oldest",
    );
    expect(visibleExecutionIds()).toEqual([
      "Abrir ejecución 31",
      "Abrir ejecución 33",
      "Abrir ejecución 32",
    ]);
  });

  it("limpia filtros y restablece el orden predeterminado", async () => {
    const user = userEvent.setup();
    renderFilterableHistory();

    const search = screen.getByRole("searchbox", { name: "Buscar" });
    const status = screen.getByRole("combobox", { name: "Estado" });
    const order = screen.getByRole("combobox", { name: "Orden" });
    await user.type(search, "compras");
    await user.selectOptions(status, "COMPLETADO");
    await user.selectOptions(order, "oldest");
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(search).toHaveValue("");
    expect(status).toHaveValue("ALL");
    expect(order).toHaveValue("newest");
    expect(visibleExecutionIds()).toEqual([
      "Abrir ejecución 32",
      "Abrir ejecución 33",
      "Abrir ejecución 31",
    ]);
  });

  it("muestra un estado vacío cuando no hay coincidencias", async () => {
    const user = userEvent.setup();
    renderFilterableHistory();

    await user.type(
      screen.getByRole("searchbox", { name: "Buscar" }),
      "sin coincidencias",
    );

    expect(
      screen.getByRole("heading", {
        name: "No hay ejecuciones que coincidan.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "0 resultados visibles",
    );
    expect(
      screen.queryByRole("link", { name: /abrir ejecución/i }),
    ).not.toBeInTheDocument();
  });
});
