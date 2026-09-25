import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConciliationResultsPanel } from "@/features/conciliations/components/conciliation-results-panel";
import { ApiError } from "@/lib/api/errors";

const SUMMARY = {
  conciliados: 1,
  diferencias_importe: 1,
  duplicados_archivo_a: 0,
  duplicados_archivo_b: 0,
  ejecucion_id: 31,
  errores_formato: 0,
  estado_ejecucion: "REQUIERE_REVISION",
  requiere_revision: 1,
  solo_archivo_a: 0,
  solo_archivo_b: 0,
  total_resultados: 2,
};

const PENDING_RESULT = {
  clave_referencia: "FAC-1",
  created_at: "2026-08-21T12:00:00Z",
  datos_archivo_a_json: { Importe: 120 },
  datos_archivo_b_json: { Monto: 100 },
  diferencia_importe: "20",
  ejecucion_id: 31,
  estado_resultado: "DIFERENCIA_IMPORTE",
  id: 71,
  observacion: null,
  requiere_revision: true,
  updated_at: null,
};

const REVISION_SUMMARY = {
  conciliados: 1,
  diferencias_importe: 1,
  duplicados_archivo_a: 0,
  duplicados_archivo_b: 0,
  ejecucion_id: 31,
  errores_formato: 0,
  estado_ejecucion: "REQUIERE_REVISION",
  pendientes_revision: 1,
  revisados: 1,
  solo_archivo_a: 0,
  solo_archivo_b: 0,
  total_resultados: 2,
};

const BASE_PROPS = {
  canExecute: true,
  configurationMessage: null,
  executing: false,
  executionError: null,
  onExecute: vi.fn(),
  resultsError: null,
  resultsLoading: false,
  stale: false,
  summary: SUMMARY,
};

describe("ConciliationResultsPanel", () => {
  it("muestra el resumen y filas con los campos reales de A/B", () => {
    render(<ConciliationResultsPanel
      {...BASE_PROPS}
      results={[{
        ...PENDING_RESULT,
        observacion: "La diferencia supera la tolerancia configurada",
      }]}
    />);

    expect(screen.getByText("Resultado de conciliación")).toBeInTheDocument();
    expect(screen.getByText("Requieren revisión")).toBeInTheDocument();
    expect(screen.getByText("FAC-1")).toBeInTheDocument();
    expect(screen.getByText("Diferencia de importe")).toBeInTheDocument();
    expect(screen.getByText("Importe")).toBeInTheDocument();
    expect(screen.getByText("Monto")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("presenta cada resultado como comparación legible antes del desktop amplio", () => {
    render(<ConciliationResultsPanel
      {...BASE_PROPS}
      results={[PENDING_RESULT]}
    />);

    expect(screen.getByRole("table")).toHaveClass("block", "xl:table", "xl:min-w-[64rem]");
    expect(screen.getByText("FAC-1").closest("tr")).toHaveClass(
      "grid",
      "min-[480px]:grid-cols-2",
      "xl:table-row",
    );
    expect(screen.getByRole("button", { name: "Revisar" })).toHaveClass(
      "w-full",
      "xl:w-auto",
    );
    expect(screen.getAllByText("Archivo A")).toHaveLength(2);
    expect(screen.getAllByText("Archivo B")).toHaveLength(2);
  });

  it("distingue precondiciones, resultado vacío y errores de resultados", () => {
    const onExecute = vi.fn();
    const { rerender } = render(<ConciliationResultsPanel
      {...BASE_PROPS}
      canExecute={false}
      configurationMessage="Guardá el mapping antes de ejecutar."
      onExecute={onExecute}
      results={undefined}
      summary={null}
    />);
    const button = screen.getByRole("button", { name: "Ejecutar conciliación" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onExecute).not.toHaveBeenCalled();

    rerender(<ConciliationResultsPanel {...BASE_PROPS} onExecute={onExecute} results={[]} />);
    expect(screen.getByText(/no produjo resultados/)).toBeInTheDocument();

    rerender(<ConciliationResultsPanel
      {...BASE_PROPS}
      onExecute={onExecute}
      results={undefined}
      resultsError={new ApiError(503, { message: "El servidor no está disponible." })}
    />);
    expect(screen.getByText("No pudimos cargar los resultados")).toBeInTheDocument();
    expect(screen.getByText("El servidor no está disponible.")).toBeInTheDocument();
  });

  it("identifica pendientes y revisados mediante filtros explícitos", () => {
    render(<ConciliationResultsPanel
      {...BASE_PROPS}
      results={[
        PENDING_RESULT,
        {
          ...PENDING_RESULT,
          clave_referencia: "FAC-2",
          id: 72,
          observacion: "Validado con el extracto",
          requiere_revision: false,
        },
      ]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Pendientes" }));
    expect(screen.getByText("FAC-1")).toBeInTheDocument();
    expect(screen.queryByText("FAC-2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revisados" }));
    expect(screen.queryByText("FAC-1")).not.toBeInTheDocument();
    expect(screen.getByText("FAC-2")).toBeInTheDocument();
    expect(screen.getByText("Validado con el extracto")).toBeInTheDocument();
  });

  it("limpia el error anterior al iniciar una nueva revisión", () => {
    const onReviewStart = vi.fn();
    render(<ConciliationResultsPanel
      {...BASE_PROPS}
      onReviewStart={onReviewStart}
      results={[PENDING_RESULT]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Revisar" }));

    expect(onReviewStart).toHaveBeenCalledTimes(1);
  });

  it("envía la decisión y la observación una sola vez mientras guarda", async () => {
    let finishSave: (() => void) | undefined;
    const onSaveReview = vi.fn(
      () => new Promise<void>((resolve) => { finishSave = resolve; }),
    );
    render(<ConciliationResultsPanel
      {...BASE_PROPS}
      onSaveReview={onSaveReview}
      results={[PENDING_RESULT]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
    expect(screen.getByRole("region", { name: "Archivo A" })).toHaveTextContent("120");
    expect(screen.getByRole("region", { name: "Archivo B" })).toHaveTextContent("100");
    fireEvent.click(screen.getByLabelText("Marcar revisión como completada"));
    fireEvent.change(screen.getByLabelText("Observación"), {
      target: { value: "Validado manualmente" },
    });

    const saveButton = screen.getByRole("button", { name: "Guardar revisión" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(onSaveReview).toHaveBeenCalledTimes(1);
    expect(onSaveReview).toHaveBeenCalledWith(PENDING_RESULT, {
      observacion: "Validado manualmente",
      requiere_revision: false,
    });
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();

    finishSave?.();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("mantiene abierto el detalle y muestra el error controlado", () => {
    render(<ConciliationResultsPanel
      {...BASE_PROPS}
      results={[PENDING_RESULT]}
      reviewError={new ApiError(409, { message: "La revisión cambió en el servidor." })}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Revisar" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("No pudimos guardar la revisión")).toBeInTheDocument();
    expect(screen.getByText("La revisión cambió en el servidor.")).toBeInTheDocument();
  });

  it("impide editar revisiones cuando la ejecución está cerrada", () => {
    render(<ConciliationResultsPanel
      {...BASE_PROPS}
      results={[PENDING_RESULT]}
      reviewAllowed={false}
    />);

    const button = screen.getByRole("button", { name: "Revisión cerrada" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("refleja los datos reconsultados y el contador vigente del backend", () => {
    render(<ConciliationResultsPanel
      {...BASE_PROPS}
      results={[{
        ...PENDING_RESULT,
        observacion: "Persistida",
        requiere_revision: false,
        updated_at: "2026-08-21T12:05:00Z",
      }]}
      revisionSummary={{
        ...REVISION_SUMMARY,
        pendientes_revision: 0,
        revisados: 2,
      }}
    />);

    expect(screen.getByText("Persistida")).toBeInTheDocument();
    expect(screen.getByText("Editar revisión")).toBeInTheDocument();
    expect(screen.getByText("Requieren revisión").parentElement).toHaveTextContent("0");
  });
});
