import { beforeEach, describe, expect, it, vi } from "vitest";

import { createExecution } from "@/features/executions/api/create-execution";
import { getExecution } from "@/features/executions/api/get-execution";
import { getProcessExecutions } from "@/features/executions/api/get-process-executions";
import { apiFetch } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));

const apiFetchMock = vi.mocked(apiFetch);

describe("API browser de ejecuciones", () => {
  beforeEach(() => {
    apiFetchMock.mockReset().mockResolvedValue([]);
  });

  it("lista ejecuciones por proceso mediante el BFF", async () => {
    await getProcessExecutions(4);

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/backend/procesos/4/ejecuciones",
    );
  });

  it("crea con POST y el body mínimo", async () => {
    await createExecution({ proceso_id: 4 });

    expect(apiFetchMock).toHaveBeenCalledWith("/api/backend/ejecuciones", {
      body: { proceso_id: 4 },
      method: "POST",
    });
    const request = JSON.stringify(apiFetchMock.mock.calls[0]);
    expect(request).not.toContain("cliente_id");
    expect(request).not.toContain("usuario_id");
    expect(request).not.toContain("estado");
  });

  it("consulta una ejecución por su ruta interna", async () => {
    await getExecution(31);

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/backend/ejecuciones/31",
    );
  });

  it.each([
    ["listado", () => getProcessExecutions(-1)],
    ["creación", () => createExecution({ proceso_id: 0 })],
    ["detalle", () => getExecution(Number.NaN)],
  ])("rechaza ID inválido en %s sin usar apiFetch", (_case, action) => {
    expect(action).toThrow(TypeError);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
