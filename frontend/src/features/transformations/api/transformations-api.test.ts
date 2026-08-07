import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTransformationSummary } from "@/features/transformations/api/get-transformation-summary";
import { apiFetch } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));

const apiFetchMock = vi.mocked(apiFetch);

describe("API browser de transformaciones", () => {
  beforeEach(() => {
    apiFetchMock.mockReset().mockResolvedValue({});
  });

  it("consulta el resumen por el BFF explícito con GET", async () => {
    await getTransformationSummary(31);

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/backend/transformaciones/31/resumen",
      { method: "GET" },
    );
    const request = JSON.stringify(apiFetchMock.mock.calls[0]);
    expect(request).not.toContain("cliente_id");
    expect(request).not.toContain("usuario_id");
    expect(request).not.toContain("BACKEND_URL");
  });

  it("rechaza un identificador inválido antes de usar apiFetch", () => {
    expect(() => getTransformationSummary(0)).toThrow(TypeError);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
