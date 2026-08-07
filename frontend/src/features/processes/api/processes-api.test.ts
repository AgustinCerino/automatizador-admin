import { beforeEach, describe, expect, it, vi } from "vitest";

import { getProcess } from "@/features/processes/api/get-process";
import { getProcesses } from "@/features/processes/api/get-processes";
import { apiFetch } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));

const apiFetchMock = vi.mocked(apiFetch);

describe("API browser de procesos", () => {
  beforeEach(() => {
    apiFetchMock.mockReset().mockResolvedValue([]);
  });

  it("lista procesos mediante el BFF sin enviar cliente_id", async () => {
    await getProcesses();

    expect(apiFetchMock).toHaveBeenCalledWith("/api/backend/procesos");
    expect(JSON.stringify(apiFetchMock.mock.calls)).not.toContain("cliente_id");
  });

  it("consulta un proceso por su ruta interna", async () => {
    await getProcess(8);

    expect(apiFetchMock).toHaveBeenCalledWith("/api/backend/procesos/8");
  });

  it("rechaza un ID inválido antes de usar apiFetch", () => {
    expect(() => getProcess(0)).toThrow(TypeError);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
