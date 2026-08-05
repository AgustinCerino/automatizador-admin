import { describe, expect, it } from "vitest";

import { navigationItems } from "@/lib/navigation";

describe("navigationItems", () => {
  it("contiene las cuatro secciones principales", () => {
    expect(navigationItems.map((item) => item.label)).toEqual([
      "Inicio",
      "Procesos",
      "Ejecuciones",
      "Plantillas",
    ]);
  });
});
