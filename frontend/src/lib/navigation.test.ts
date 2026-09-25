import { describe, expect, it } from "vitest";

import { getPageContextLabel, navigationItems } from "@/lib/navigation";

describe("navigationItems", () => {
  it("contiene las cuatro secciones principales", () => {
    expect(navigationItems.map((item) => item.label)).toEqual([
      "Inicio",
      "Procesos",
      "Ejecuciones",
      "Plantillas",
    ]);
  });

  it("identifica el workspace dinámico de Conciliación Excel", () => {
    expect(getPageContextLabel("/conciliaciones/31")).toBe("Conciliación Excel");
    expect(getPageContextLabel("/procesos")).toBe("Procesos");
    expect(getPageContextLabel("/ruta-desconocida")).toBe("Página");
  });
});
