import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approveConciliation,
  downloadConciliationExport,
  rejectConciliation,
} from "@/features/conciliations/api/conciliation-results-api";

describe("conciliation closure api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("usa los endpoints y payloads de aprobación y rechazo", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ ejecucion_id: 31 }))
      .mockResolvedValueOnce(Response.json({ ejecucion_id: 31 }));
    vi.stubGlobal("fetch", fetchMock);

    await approveConciliation(31);
    await rejectConciliation(31, { motivo: "Datos inconsistentes" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/backend/conciliaciones/31/aprobar",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/backend/conciliaciones/31/rechazar",
      expect.objectContaining({
        body: JSON.stringify({ motivo: "Datos inconsistentes" }),
        method: "POST",
      }),
    );
  });

  it("descarga con el nombre entregado por el BFF", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectURL = vi.fn(() => "blob:result");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(new Blob(["xlsx"]), {
        headers: {
          "Content-Disposition": "attachment; filename=conciliacion_ejecucion_31.xlsx",
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      }),
    ));

    await downloadConciliationExport(31);

    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:result");
    click.mockRestore();
  });
});
