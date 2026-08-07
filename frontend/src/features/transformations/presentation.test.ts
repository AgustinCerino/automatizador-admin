import { describe, expect, it } from "vitest";

import { getTransformationSummaryRefetchInterval } from "@/features/transformations/api/use-transformation-summary-query";
import {
  getActionPresentation,
  getTransformationSteps,
} from "@/features/transformations/presentation";
import type {
  TransformationAction,
  TransformationSummary,
} from "@/features/transformations/types";

const SUMMARY = {
  action_required: "CONFIGURE",
  can_download: false,
  can_edit_configuration: true,
  can_generate: false,
  can_validate: false,
  ejecucion_id: 31,
  errors_count: 0,
  estado_ejecucion: "CARGADO",
  generation: { available: false, file_exists: false },
  has_configuration: false,
  issues: [],
  proceso_id: 4,
  proceso_nombre: "Transformación Excel",
  source: null,
  validation: { available: false },
  warnings_count: 0,
} satisfies TransformationSummary;

function steps(overrides: Partial<TransformationSummary> = {}) {
  return getTransformationSteps({ ...SUMMARY, ...overrides });
}

describe("presentación de acciones", () => {
  it.each<[TransformationAction, string]>([
    ["CONFIGURE", "Configurar transformación"],
    ["VALIDATE", "Validar configuración"],
    ["FIX_ERRORS", "Corregir errores"],
    ["GENERATE", "Generar archivo"],
    ["WAIT", "Procesamiento en curso"],
    ["DOWNLOAD", "Archivo listo para descargar"],
    ["REGENERATE", "Regenerar archivo"],
    ["REVIEW_ERROR", "Revisar problema"],
    ["NONE", "Sin acciones pendientes"],
  ])("representa %s", (action, label) => {
    expect(getActionPresentation(action).label).toBe(label);
  });

  it("usa un fallback seguro ante una acción futura", () => {
    expect(getActionPresentation("FUTURE_ACTION")).toMatchObject({
      label: "Revisar estado",
      tone: "warning",
    });
  });
});

describe("presentación de etapas", () => {
  it("marca configuración como actual en una ejecución inicial", () => {
    expect(steps().map((step) => step.state)).toEqual([
      "pending",
      "current",
      "pending",
      "pending",
    ]);
  });

  it("representa archivo existente y archivo faltante", () => {
    const source = {
      archivo_id: 8,
      checksum: null,
      extension: ".xlsx",
      file_exists: true,
      header_row: 1,
      nombre_original: "origen.xlsx",
      sheet_name: "Datos",
    };

    expect(steps({ source })[0].state).toBe("completed");
    expect(steps({ source: { ...source, file_exists: false } })[0].state).toBe(
      "error",
    );
  });

  it("representa configuración guardada", () => {
    expect(steps({ has_configuration: true })[1].state).toBe("completed");
  });

  it("representa validación válida, inválida y sin resultado booleano", () => {
    expect(steps({ validation: { available: true, valid: true } })[2].state).toBe(
      "completed",
    );
    expect(steps({ validation: { available: true, valid: false } })[2].state).toBe(
      "error",
    );
    expect(steps({ validation: { available: true, valid: null } })[2].state).toBe(
      "warning",
    );
  });

  it("representa resultado disponible y registro con archivo faltante", () => {
    expect(
      steps({ generation: { available: true, file_exists: true } })[3].state,
    ).toBe("completed");
    expect(
      steps({ generation: { available: true, file_exists: false } })[3].state,
    ).toBe("error");
  });
});

describe("polling del resumen", () => {
  it("usa tres segundos sólo mientras el estado es PROCESANDO", () => {
    expect(
      getTransformationSummaryRefetchInterval({
        ...SUMMARY,
        estado_ejecucion: "PROCESANDO",
      }),
    ).toBe(3_000);
    expect(
      getTransformationSummaryRefetchInterval({
        ...SUMMARY,
        estado_ejecucion: "COMPLETADO",
      }),
    ).toBe(false);
    expect(
      getTransformationSummaryRefetchInterval({
        ...SUMMARY,
        estado_ejecucion: "ERROR",
      }),
    ).toBe(false);
  });
});
