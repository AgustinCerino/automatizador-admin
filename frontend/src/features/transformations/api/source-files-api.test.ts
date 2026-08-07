import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  inspectTransformationSourceFile,
  listTransformationSourceFiles,
  uploadTransformationSourceFile,
} from "@/features/transformations/api/source-files-api";
import { apiFetch } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
const apiFetchMock = vi.mocked(apiFetch);

describe("API browser de archivos fuente", () => {
  beforeEach(() => apiFetchMock.mockReset().mockResolvedValue({}));

  it("usa las rutas BFF explícitas", async () => {
    await listTransformationSourceFiles(31);
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/api/backend/transformaciones/31/archivos",
      { method: "GET" },
    );

    await inspectTransformationSourceFile({
      executionId: 31,
      fileId: 8,
      headerRow: 2,
      sheet: " Ventas 2026 ",
    });
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/api/backend/transformaciones/31/archivos/8/estructura?headerRow=2&sheet=+Ventas+2026+",
      { method: "GET" },
    );
  });

  it("envía al BFF únicamente el archivo", async () => {
    const file = new File(["a,b"], "origen.csv");
    await uploadTransformationSourceFile(31, file);
    const options = apiFetchMock.mock.calls[0][1];
    const body = options?.body as FormData;
    expect([...body.keys()]).toEqual(["file"]);
    expect((body.get("file") as File).name).toBe("origen.csv");
  });

  it("no envía sheet para CSV cuando recibe null", async () => {
    await inspectTransformationSourceFile({
      executionId: 31,
      fileId: 8,
      headerRow: 1,
      sheet: null,
    });
    expect(apiFetchMock.mock.calls[0][0]).toBe(
      "/api/backend/transformaciones/31/archivos/8/estructura?headerRow=1",
    );
  });

  it("rechaza identificadores y filas inválidas antes de fetch", () => {
    expect(() => listTransformationSourceFiles(0)).toThrow(TypeError);
    expect(() => inspectTransformationSourceFile({ executionId: 31, fileId: 8, headerRow: 0, sheet: null })).toThrow(TypeError);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
