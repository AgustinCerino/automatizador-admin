import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TransformationValidationPanel } from "@/features/transformations/components/transformation-validation-panel";
import type { TransformationValidationRead } from "@/features/transformations/types";

const RESULT = {
  columnas_salida: ["Cliente", "Importe"], duplicados_detectados: 1, duplicados_eliminados: 1,
  ejecucion_id: 31, errors: [], estado_ejecucion: "VALIDADO", filas_con_advertencias: 1,
  filas_con_errores: 0, filas_despues_filtros: 2, filas_excluidas_por_filtros: 1,
  filas_validas: 2, preview_rows: [{ Cliente: "ACME", Importe: 42 }], total_filas_entrada: 3,
  valid: true, validated_at: "2026-08-12T12:00:00Z",
  warnings: [{ code: "WARNING", count: 1, message: "Dato incompleto" }],
} satisfies TransformationValidationRead;

describe("TransformationValidationPanel", () => {
  it("muestra loading y evita solicitudes duplicadas", async () => {
    const validate = vi.fn();
    const { rerender } = render(<TransformationValidationPanel errorMessage={null} isDirty={false} isPending={false} isSaved onValidate={validate} result={null} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Validar transformación" }));
    expect(validate).toHaveBeenCalledOnce();
    rerender(<TransformationValidationPanel errorMessage={null} isDirty={false} isPending isSaved onValidate={validate} result={null} />);
    expect(screen.getByRole("button", { name: "Validando…" })).toBeDisabled();
  });

  it("muestra preview, métricas y advertencias del contrato", () => {
    render(<TransformationValidationPanel errorMessage={null} isDirty={false} isPending={false} isSaved onValidate={vi.fn()} result={RESULT} />);
    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByText("Filas de entrada")).toBeInTheDocument();
    expect(screen.getByText("Dato incompleto")).toBeInTheDocument();
  });

  it("impide validar un borrador sin guardar y marca el resultado anterior como desactualizado", () => {
    render(<TransformationValidationPanel errorMessage={null} isDirty isPending={false} isSaved onValidate={vi.fn()} result={RESULT} />);
    expect(screen.getByText("Configuración modificada")).toBeInTheDocument();
    expect(screen.getByText("Validación desactualizada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validar transformación" })).toBeDisabled();
  });

  it("diferencia los errores funcionales devueltos por el backend", () => {
    render(<TransformationValidationPanel errorMessage={null} isDirty={false} isPending={false} isSaved onValidate={vi.fn()} result={{ ...RESULT, errors: [{ code: "SOURCE_COLUMN_NOT_FOUND", count: 1, message: "No existe la columna de origen" }], valid: false }} />);
    expect(screen.getByText("Errores funcionales")).toBeInTheDocument();
    expect(screen.getByText("No existe la columna de origen")).toBeInTheDocument();
  });

  it("muestra errores técnicos controlados", () => {
    render(<TransformationValidationPanel errorMessage="El servidor no está disponible." isDirty={false} isPending={false} isSaved onValidate={vi.fn()} result={null} />);
    expect(screen.getByText("El servidor no está disponible.")).toBeInTheDocument();
  });
});
