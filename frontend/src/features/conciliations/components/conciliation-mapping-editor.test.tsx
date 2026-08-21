import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConciliationMappingEditor } from "@/features/conciliations/components/conciliation-mapping-editor";
import type { ConciliationMapping } from "@/features/conciliations/types";

const MAPPING: ConciliationMapping = {
  archivo_a_id: 1,
  archivo_b_id: 2,
  columna_clave_archivo_a: "Factura",
  columna_clave_archivo_b: "Comprobante",
  columna_importe_archivo_a: "Importe",
  columna_importe_archivo_b: "Monto",
  columnas_archivo_a: ["Factura", "Importe"],
  columnas_archivo_b: ["Comprobante", "Monto"],
  detectar_duplicados: true,
  tolerancia_importe: 0,
};

function renderEditor(overrides: Partial<ComponentProps<typeof ConciliationMappingEditor>> = {}) {
  const onSave = vi.fn().mockResolvedValue(MAPPING);
  render(
    <ConciliationMappingEditor
      archivoAId={1}
      archivoBId={2}
      columnsA={["Factura", "Importe"]}
      columnsB={["Comprobante", "Monto"]}
      columnsError={null}
      mapping={MAPPING}
      mappingError={null}
      mappingLoading={false}
      mappingSelectionDirty={false}
      onRetry={vi.fn()}
      onRetryColumns={vi.fn()}
      onSave={onSave}
      saveError={null}
      saving={false}
      {...overrides}
    />,
  );
  return onSave;
}

describe("ConciliationMappingEditor", () => {
  it("requiere que A y B estén persistidos antes de habilitar el editor", () => {
    renderEditor({ archivoAId: null, mapping: null });
    expect(screen.getByText("Seleccioná ambos archivos antes de configurar el mapping.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar mapping" })).not.toBeInTheDocument();
  });

  it("reconstruye el mapping y guarda el payload exacto tras un cambio", async () => {
    const onSave = renderEditor();
    expect(screen.getByText("Mapping sincronizado")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tolerancia de importe"), { target: { value: "1.5" } });
    expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar mapping" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      archivo_a_id: 1,
      archivo_b_id: 2,
      columna_clave_archivo_a: "Factura",
      columna_clave_archivo_b: "Comprobante",
      columna_importe_archivo_a: "Importe",
      columna_importe_archivo_b: "Monto",
      detectar_duplicados: true,
      tolerancia_importe: 1.5,
    }));
  });

  it("invalida la presentación cuando el mapping es de otro par A/B", () => {
    renderEditor({ archivoAId: 3, mapping: MAPPING });
    expect(screen.getByText("Mapping desactualizado")).toBeInTheDocument();
    expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();
  });

  it("señala una columna histórica que ya no existe", () => {
    renderEditor({ columnsA: ["Factura"], mapping: { ...MAPPING, columna_importe_archivo_a: "Importe eliminado" } });
    expect(screen.getByText("Hay columnas que ya no existen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar mapping" })).toBeDisabled();
  });
});
