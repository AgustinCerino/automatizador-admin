import { describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth/types";
import { handleValidateTransformationConfigurationRequest } from "@/lib/api/authenticated-route-handlers";

type Dependencies = Parameters<typeof handleValidateTransformationConfigurationRequest>[2];

const USER = { cliente_id: 7, email: "admin@example.com", estado: "ACTIVO", id: 12, nombre: "Administración", rol: "ADMIN" } satisfies CurrentUser;

function dependencies(): Dependencies {
  return {
    clearSessionToken: vi.fn().mockResolvedValue(undefined),
    fetchBackend: vi.fn().mockResolvedValue(Response.json({ valid: true })),
    requireSession: vi.fn().mockResolvedValue({ token: "header.payload.signature", user: USER }),
  } as Dependencies;
}

describe("BFF de validación de transformaciones", () => {
  it("reenvía el dry-run autenticado con un límite de preview acotado", async () => {
    const deps = dependencies();
    const response = await handleValidateTransformationConfigurationRequest(
      new Request("http://localhost/api/backend/transformaciones/31/validar", { headers: { Origin: "http://localhost" }, method: "POST" }),
      "31",
      deps,
    );

    expect(response.status).toBe(200);
    expect(deps.fetchBackend).toHaveBeenCalledWith(
      "/transformaciones-excel/31/validar?preview_limit=20",
      "header.payload.signature",
      { headers: { Accept: "application/json" }, method: "POST" },
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rechaza validación cross-origin antes de usar la sesión", async () => {
    const deps = dependencies();
    const response = await handleValidateTransformationConfigurationRequest(
      new Request("http://localhost/api/backend/transformaciones/31/validar", { headers: { Origin: "https://attacker.example" }, method: "POST" }),
      "31",
      deps,
    );
    expect(response.status).toBe(403);
    expect(deps.requireSession).not.toHaveBeenCalled();
  });
});
