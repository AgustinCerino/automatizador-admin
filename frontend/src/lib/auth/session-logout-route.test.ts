import { afterEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth/types";
import { BackendRequestError } from "@/lib/api/server-utils";
import { AuthBackendResponseError } from "@/lib/auth/backend-contract";
import {
  handleLogoutRequest,
  handleSessionRequest,
} from "@/lib/auth/route-handlers";

type SessionDependencies = Parameters<typeof handleSessionRequest>[0];
type LogoutDependencies = Parameters<typeof handleLogoutRequest>[1];

const TOKEN = "header.payload.signature";
const CURRENT_USER = {
  cliente_id: 7,
  email: "admin@example.com",
  estado: "ACTIVO",
  id: 12,
  nombre: "Administración",
  rol: "ADMIN",
} satisfies CurrentUser;

const CURRENT_USER_WITH_SENSITIVE_EXTRA = {
  ...CURRENT_USER,
  access_token: TOKEN,
};

function createSessionDependencies(
  overrides: Partial<SessionDependencies> = {},
): SessionDependencies {
  return {
    clearSessionToken: vi.fn<SessionDependencies["clearSessionToken"]>()
      .mockResolvedValue(undefined),
    getCurrentUser: vi.fn<SessionDependencies["getCurrentUser"]>()
      .mockResolvedValue({
        status: "authenticated",
        user: CURRENT_USER_WITH_SENSITIVE_EXTRA,
      }),
    readSessionToken: vi.fn<SessionDependencies["readSessionToken"]>()
      .mockResolvedValue(TOKEN),
    ...overrides,
  };
}

function createLogoutDependencies(): LogoutDependencies {
  return {
    clearSessionToken: vi.fn<LogoutDependencies["clearSessionToken"]>()
      .mockResolvedValue(undefined),
  };
}

function createLogoutRequest(origin?: string): Request {
  const headers = new Headers();

  if (origin) {
    headers.set("Origin", origin);
  }

  return new Request("https://app.test/api/auth/logout", {
    headers,
    method: "POST",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleSessionRequest", () => {
  it("responde sesión anónima sin cookie y no consulta /auth/me", async () => {
    const dependencies = createSessionDependencies({
      readSessionToken: vi
        .fn<SessionDependencies["readSessionToken"]>()
        .mockResolvedValue(undefined),
    });

    const response = await handleSessionRequest(dependencies);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      authenticated: false,
      user: null,
    });
    expect(dependencies.getCurrentUser).not.toHaveBeenCalled();
    expect(dependencies.clearSessionToken).not.toHaveBeenCalled();
  });

  it("valida la cookie contra /auth/me y devuelve el usuario sin exponer el token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No debe haber red real"));
    const dependencies = createSessionDependencies();

    const response = await handleSessionRequest(dependencies);
    const responseText = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(responseText)).toEqual({
      authenticated: true,
      user: CURRENT_USER,
    });
    expect(responseText).not.toContain(TOKEN);
    expect(responseText).not.toContain("access_token");
    expect(dependencies.getCurrentUser).toHaveBeenCalledWith(TOKEN);
    expect(dependencies.clearSessionToken).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(["invalid", "forbidden"] as const)(
    "limpia la cookie y responde sesión anónima para estado %s",
    async (status) => {
      const dependencies = createSessionDependencies({
        getCurrentUser: vi
          .fn<SessionDependencies["getCurrentUser"]>()
          .mockResolvedValue({ status }),
      });

      const response = await handleSessionRequest(dependencies);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        authenticated: false,
        user: null,
      });
      expect(dependencies.clearSessionToken).toHaveBeenCalledOnce();
    },
  );

  it("devuelve 503 si falla la red y conserva la cookie para no confundir indisponibilidad con expiración", async () => {
    const internalUrl = "http://backend.internal:8000/auth/me";
    const dependencies = createSessionDependencies({
      getCurrentUser: vi
        .fn<SessionDependencies["getCurrentUser"]>()
        .mockRejectedValue(
          new BackendRequestError("network", `Fallo en ${internalUrl}`),
        ),
    });

    const response = await handleSessionRequest(dependencies);
    const responseText = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(responseText).not.toContain(internalUrl);
    expect(responseText).not.toContain(TOKEN);
    expect(dependencies.clearSessionToken).not.toHaveBeenCalled();
  });

  it("devuelve 503 ante un Service Unavailable HTTP y conserva la cookie", async () => {
    const dependencies = createSessionDependencies({
      getCurrentUser: vi
        .fn<SessionDependencies["getCurrentUser"]>()
        .mockRejectedValue(new AuthBackendResponseError(503)),
    });

    const response = await handleSessionRequest(dependencies);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      code: "BACKEND_UNAVAILABLE",
      message: "El servidor no está disponible. Intentá nuevamente.",
    });
    expect(dependencies.clearSessionToken).not.toHaveBeenCalled();
  });
});

describe("handleLogoutRequest", () => {
  it.each([
    ["con una sesión previa", "https://app.test"],
    ["sin una sesión previa", undefined],
  ])("es idempotente %s: limpia la cookie y devuelve 204", async (_case, origin) => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No debe consultar el backend"));
    const dependencies = createLogoutDependencies();

    const response = await handleLogoutRequest(
      createLogoutRequest(origin),
      dependencies,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("");
    expect(dependencies.clearSessionToken).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rechaza un Origin externo sin limpiar la cookie ni consultar el backend", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No debe consultar el backend"));
    const dependencies = createLogoutDependencies();

    const response = await handleLogoutRequest(
      createLogoutRequest("https://externo.test"),
      dependencies,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_ORIGIN",
    });
    expect(dependencies.clearSessionToken).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
