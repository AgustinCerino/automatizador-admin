import { fireEvent, render, screen } from "@testing-library/react";
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

describe("ConciliationResultsPanel", () => {
  it("muestra el resumen y filas con los campos reales de A/B", () => {
    render(<ConciliationResultsPanel
      canExecute
      configurationMessage={null}
      executing={false}
      executionError={null}
      onExecute={vi.fn()}
      results={[{
        clave_referencia: "FAC-1",
        created_at: "2026-08-21T12:00:00Z",
        datos_archivo_a_json: { Importe: 120 },
        datos_archivo_b_json: { Monto: 100 },
        diferencia_importe: "20",
        ejecucion_id: 31,
        estado_resultado: "DIFERENCIA_IMPORTE",
        id: 71,
        observacion: "La diferencia supera la tolerancia configurada",
        requiere_revision: true,
        updated_at: null,
      }]}
      resultsError={null}
      resultsLoading={false}
      stale={false}
      summary={SUMMARY}
    />);

    expect(screen.getByText("Resultado de conciliación")).toBeInTheDocument();
    expect(screen.getByText("Requieren revisión")).toBeInTheDocument();
    expect(screen.getByText("FAC-1")).toBeInTheDocument();
    expect(screen.getByText("Diferencia de importe")).toBeInTheDocument();
    expect(screen.getByText("Importe")).toBeInTheDocument();
    expect(screen.getByText("Monto")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("distingue precondiciones, resultado vacío y errores de resultados", () => {
    const onExecute = vi.fn();
    const { rerender } = render(<ConciliationResultsPanel
      canExecute={false}
      configurationMessage="Guardá el mapping antes de ejecutar."
      executing={false}
      executionError={null}
      onExecute={onExecute}
      results={undefined}
      resultsError={null}
      resultsLoading={false}
      stale={false}
      summary={null}
    />);
    const button = screen.getByRole("button", { name: "Ejecutar conciliación" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onExecute).not.toHaveBeenCalled();

    rerender(<ConciliationResultsPanel
      canExecute
      configurationMessage={null}
      executing={false}
      executionError={null}
      onExecute={onExecute}
      results={[]}
      resultsError={null}
      resultsLoading={false}
      stale={false}
      summary={SUMMARY}
    />);
    expect(screen.getByText(/no produjo resultados/)).toBeInTheDocument();

    rerender(<ConciliationResultsPanel
      canExecute
      configurationMessage={null}
      executing={false}
      executionError={null}
      onExecute={onExecute}
      results={undefined}
      resultsError={new ApiError(503, { message: "El servidor no está disponible." })}
      resultsLoading={false}
      stale={false}
      summary={SUMMARY}
    />);
    expect(screen.getByText("No pudimos cargar los resultados")).toBeInTheDocument();
    expect(screen.getByText("El servidor no está disponible.")).toBeInTheDocument();
  });
});
