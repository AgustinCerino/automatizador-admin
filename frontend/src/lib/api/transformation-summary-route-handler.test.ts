import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth/types";
import type { TransformationSummary } from "@/features/transformations/types";
import { handleGetTransformationSummaryRequest } from "@/lib/api/authenticated-route-handlers";
import { BackendRequestError } from "@/lib/api/server-utils";
import { RequiredSessionError } from "@/lib/auth/session-contract";

type Dependencies = Parameters<typeof handleGetTransformationSummaryRequest>[1];

const TOKEN = "header.payload.signature";
const CURRENT_USER = {
  cliente_id: 7,
  email: "admin@example.com",
  estado: "ACTIVO",
  id: 12,
  nombre: "Administración",
  rol: "ADMIN",
} satisfies CurrentUser;

const SUMMARY = {
  action_required: "CONFIGURE",
  can_download: false,
  can_edit_configuration: true,
  can_generate: false,
  can_validate: false,
  created_at: "2026-08-07T12:00:00Z",
  ejecucion_id: 31,
  errors_count: 0,
  estado_ejecucion: "CARGADO",
  generation: { available: false, file_exists: false },
  has_configuration: false,
  issues: [],
  proceso_id: 4,
  proceso_nombre: "Transformación Excel",
  source: null,
  template: null,
  updated_at: null,
  validation: { available: false },
  warnings_count: 0,
} satisfies TransformationSummary;

function createDependencies(
  overrides: Partial<Dependencies> = {},
): Dependencies {
  return {
    clearSessionToken: vi.fn<Dependencies["clearSessionToken"]>()
      .mockResolvedValue(undefined),
    fetchBackend: vi.fn<Dependencies["fetchBackend"]>().mockResolvedValue(
      Response.json(SUMMARY),
    ),
    requireSession: vi.fn<Dependencies["requireSession"]>().mockResolvedValue({
      token: TOKEN,
      user: CURRENT_USER,
    }),
    ...overrides,
  };
}

describe("BFF del resumen de transformación", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reenvía el GET autenticado por una ruta fija y sin cache", async () => {
    const dependencies = createDependencies();
    const response = await handleGetTransformationSummaryRequest(
      "31",
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual(SUMMARY);
    expect(dependencies.fetchBackend).toHaveBeenCalledWith(
      "/transformaciones-excel/31/resumen",
      TOKEN,
      { headers: { Accept: "application/json" }, method: "GET" },
    );
  });

  it("rechaza un ID inválido antes de autenticar", async () => {
    const dependencies = createDependencies();
    const response = await handleGetTransformationSummaryRequest(
      "31?cliente_id=999",
      dependencies,
    );

    expect(response.status).toBe(400);
    expect(dependencies.requireSession).not.toHaveBeenCalled();
    expect(dependencies.fetchBackend).not.toHaveBeenCalled();
  });

  it("responde 401 cuando no hay sesión", async () => {
    const dependencies = createDependencies({
      requireSession: vi.fn<Dependencies["requireSession"]>()
        .mockRejectedValue(new RequiredSessionError("unauthenticated")),
    });

    const response = await handleGetTransformationSummaryRequest("31", dependencies);

    expect(response.status).toBe(401);
    expect(dependencies.fetchBackend).not.toHaveBeenCalled();
  });

  it("borra la cookie y devuelve SESSION_EXPIRED ante un 401 upstream", async () => {
    const dependencies = createDependencies({
      fetchBackend: vi.fn<Dependencies["fetchBackend"]>().mockResolvedValue(
        Response.json({ detail: "expired" }, { status: 401 }),
      ),
    });

    const response = await handleGetTransformationSummaryRequest("31", dependencies);

    expect(response.status).toBe(401);
    expect(dependencies.clearSessionToken).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it.each([
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [500, "INTERNAL_SERVER_ERROR"],
  ])("normaliza backend %i sin filtrar su detalle", async (status, code) => {
    const dependencies = createDependencies({
      fetchBackend: vi.fn<Dependencies["fetchBackend"]>().mockResolvedValue(
        Response.json({ detail: "token /storage/private traceback" }, { status }),
      ),
    });

    const response = await handleGetTransformationSummaryRequest("31", dependencies);
    const payload = await response.json();

    expect(response.status).toBe(status);
    expect(payload.code).toBe(code);
    expect(JSON.stringify(payload)).not.toContain("storage");
    expect(JSON.stringify(payload)).not.toContain("token");
  });

  it("normaliza el 400 incompatible con un mensaje específico", async () => {
    const dependencies = createDependencies({
      fetchBackend: vi.fn<Dependencies["fetchBackend"]>().mockResolvedValue(
        Response.json({ detail: "tipo interno" }, { status: 400 }),
      ),
    });

    const response = await handleGetTransformationSummaryRequest("31", dependencies);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "INCOMPATIBLE_TRANSFORMATION",
      message: "Esta ejecución no corresponde a una transformación Excel.",
    });
  });

  it("normaliza una caída del backend como 503", async () => {
    const dependencies = createDependencies({
      fetchBackend: vi.fn<Dependencies["fetchBackend"]>()
        .mockRejectedValue(new BackendRequestError("network", "internal")),
    });

    const response = await handleGetTransformationSummaryRequest("31", dependencies);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "BACKEND_UNAVAILABLE",
    });
  });
});
