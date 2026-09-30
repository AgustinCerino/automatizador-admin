import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadTransformationResult } from "@/features/transformations/api/download-transformation-result";

describe("downloadTransformationResult", () => {
  let downloadedFilename: string | undefined;

  beforeEach(() => {
    downloadedFilename = undefined;
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:resultado"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFilename = this.download;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("preserva el filename y el tipo XLSX entregados por el BFF", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Uint8Array([80, 75]), {
        headers: {
          "Content-Disposition":
            "attachment; filename*=UTF-8''resultado%20hist%C3%B3rico.xlsx",
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      }),
    );

    await downloadTransformationResult(31, "fallback.xlsx");

    expect(fetch).toHaveBeenCalledWith(
      "/api/backend/transformaciones/31/resultado/descargar",
      expect.objectContaining({
        credentials: "same-origin",
        headers: {
          Accept:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        method: "GET",
      }),
    );
    expect(downloadedFilename).toBe("resultado histórico.xlsx");
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("propaga un error backend controlado sin crear una descarga", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(
        { code: "NOT_FOUND", message: "El recurso solicitado no existe." },
        { status: 404 },
      ),
    );

    await expect(downloadTransformationResult(31)).rejects.toEqual(
      expect.objectContaining({
        message: "El recurso solicitado no existe.",
        status: 404,
      }),
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
