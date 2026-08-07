import { describe, expect, it } from "vitest";

import { getExecutionHref } from "@/features/executions/navigation";

describe("getExecutionHref", () => {
  it("dirige TRANSFORMACION_EXCEL a su workspace mínimo", () => {
    expect(getExecutionHref("TRANSFORMACION_EXCEL", 27)).toBe(
      "/transformaciones/27",
    );
  });

  it("rechaza IDs inválidos", () => {
    expect(() => getExecutionHref("TRANSFORMACION_EXCEL", 0)).toThrow(
      TypeError,
    );
  });

  it("permanece en el historial para tipos sin una vista implementada", () => {
    expect(getExecutionHref("CONCILIACION_EXCEL", 27)).toBeUndefined();
    expect(getExecutionHref("TIPO_DESCONOCIDO", 27)).toBeUndefined();
  });
});
