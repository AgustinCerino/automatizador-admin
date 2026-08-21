import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getConciliationFilePreview,
  getConciliationFileSelection,
  listConciliationFiles,
  saveConciliationFileSelection,
  uploadConciliationFile,
} from "@/features/conciliations/api/conciliation-files-api";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
const apiFetchMock = vi.mocked(apiFetch);

describe("API browser de archivos de conciliación", () => {
  beforeEach(() => apiFetchMock.mockReset().mockResolvedValue({}));

  it("usa exclusivamente las rutas BFF de conciliación", async () => {
    await listConciliationFiles(31);
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/api/backend/conciliaciones/31/archivos-disponibles",
      { method: "GET" },
    );

    await getConciliationFilePreview(31, 8);
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/api/backend/conciliaciones/31/archivos/8/preview",
      { method: "GET" },
    );
  });

  it("envía al upload sólo el archivo seleccionado", async () => {
    const file = new File(["a,b"], "origen.csv");
    await uploadConciliationFile(31, file);
    const body = apiFetchMock.mock.calls[0][1]?.body as FormData;
    expect([...body.keys()]).toEqual(["file"]);
    expect((body.get("file") as File).name).toBe("origen.csv");
  });

  it("persiste exactamente archivo_a_id y archivo_b_id con PUT", async () => {
    const selection = { archivo_a_id: 8, archivo_b_id: 9 };
    await saveConciliationFileSelection(31, selection);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/backend/conciliaciones/31/archivos",
      { body: selection, method: "PUT" },
    );
  });

  it("representa la ausencia controlada de selección como null", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(404, {
        code: "CONCILIATION_SELECTION_NOT_FOUND",
        message: "Todavía no hay selección.",
      }),
    );
    await expect(getConciliationFileSelection(31)).resolves.toBeNull();
  });

  it("no oculta otros errores 404 ni identificadores inválidos", async () => {
    const error = new ApiError(404, { code: "NOT_FOUND", message: "No existe" });
    apiFetchMock.mockRejectedValueOnce(error);
    await expect(getConciliationFileSelection(31)).rejects.toBe(error);
    expect(() => listConciliationFiles(0)).toThrow(TypeError);
    expect(() => getConciliationFilePreview(31, 0)).toThrow(TypeError);
  });
});
