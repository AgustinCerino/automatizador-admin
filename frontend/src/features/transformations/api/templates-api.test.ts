import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTransformationTemplate,
  createTransformationTemplate,
  deactivateTransformationTemplate,
  listTransformationTemplates,
  updateTransformationTemplate,
} from "@/features/transformations/api/templates-api";
import { apiFetch } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));

const apiFetchMock = vi.mocked(apiFetch);

describe("API browser de plantillas de transformación", () => {
  beforeEach(() => apiFetchMock.mockReset().mockResolvedValue({}));

  it("lista plantillas mediante el BFF de la ejecución", async () => {
    await listTransformationTemplates(31);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/backend/transformaciones/31/plantillas",
      { method: "GET" },
    );
  });

  it("crea una plantilla con nombre y descripción únicamente", async () => {
    await createTransformationTemplate(31, { nombre: "Mensual", descripcion: "Ventas" });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/backend/transformaciones/31/plantillas",
      { body: { nombre: "Mensual", descripcion: "Ventas" }, method: "POST" },
    );
  });

  it("aplica la plantilla con la fuente, hoja y encabezado actuales", async () => {
    await applyTransformationTemplate(31, 9, {
      archivo_id: 8,
      header_row: 2,
      sheet_name: "Datos",
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/backend/transformaciones/31/plantillas/9/aplicar",
      {
        body: { archivo_id: 8, header_row: 2, sheet_name: "Datos" },
        method: "POST",
      },
    );
  });

  it("actualiza sólo metadata y desactiva lógicamente", async () => {
    await updateTransformationTemplate(31, 9, { nombre: "Nuevo", descripcion: null });
    await deactivateTransformationTemplate(31, 9);
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/backend/transformaciones/31/plantillas/9",
      { body: { nombre: "Nuevo", descripcion: null }, method: "PUT" },
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/backend/transformaciones/31/plantillas/9",
      { method: "DELETE" },
    );
  });

  it("rechaza identificadores inválidos antes de llamar al BFF", () => {
    expect(() => listTransformationTemplates(0)).toThrow(TypeError);
    expect(() => applyTransformationTemplate(31, 0, { archivo_id: 8 })).toThrow(TypeError);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
