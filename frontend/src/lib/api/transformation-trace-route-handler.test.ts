import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth/types";
import { handleGetTransformationTraceRequest } from "@/lib/api/authenticated-route-handlers";
import { BackendRequestError } from "@/lib/api/server-utils";

type Dependencies = Parameters<typeof handleGetTransformationTraceRequest>[1];

const USER = {
  cliente_id: 7,
  email: "admin@example.com",
  estado: "ACTIVO",
  id: 12,
  nombre: "Administración",
  rol: "ADMIN",
} satisfies CurrentUser;

function dependencies(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    clearSessionToken: vi.fn<Dependencies["clearSessionToken"]>().mockResolvedValue(undefined),
    fetchBackend: vi.fn<Dependencies["fetchBackend"]>().mockResolvedValue(
      Response.json({ ejecucion_id: 31, items: [], limit: 50, total: 0 }),
    ),
    requireSession: vi.fn<Dependencies["requireSession"]>().mockResolvedValue({
      token: "header.payload.signature",
      user: USER,
    }),
    ...overrides,
  };
}

describe("BFF de trazabilidad de transformación", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("reenvía el GET autenticado por una ruta fija y sin cache", async () => {
    const deps = dependencies();
    const response = await handleGetTransformationTraceRequest("31", deps);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(deps.fetchBackend).toHaveBeenCalledWith(
      "/transformaciones-excel/31/trazabilidad",
      "header.payload.signature",
      { headers: { Accept: "application/json" }, method: "GET" },
    );
  });

  it("rechaza un ID inválido antes de autenticar", async () => {
    const deps = dependencies();
    const response = await handleGetTransformationTraceRequest("31?limit=200", deps);

    expect(response.status).toBe(400);
    expect(deps.requireSession).not.toHaveBeenCalled();
    expect(deps.fetchBackend).not.toHaveBeenCalled();
  });

  it("normaliza una caída del backend sin exponer detalles", async () => {
    const deps = dependencies({
      fetchBackend: vi.fn<Dependencies["fetchBackend"]>().mockRejectedValue(
        new BackendRequestError("network", "token /storage/private"),
      ),
    });
    const response = await handleGetTransformationTraceRequest("31", deps);

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("storage");
  });
});
