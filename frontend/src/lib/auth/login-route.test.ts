import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AuthLoginBackendResponse,
  CurrentUser,
} from "@/features/auth/types";
import { BackendRequestError } from "@/lib/api/server-utils";
import { handleLoginRequest } from "@/lib/auth/route-handlers";

type LoginDependencies = Parameters<typeof handleLoginRequest>[1];

const TOKEN = "header.payload.signature";
const PASSWORD = "contraseña-super-secreta";
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

const LOGIN_RESPONSE = {
  access_token: TOKEN,
  token_type: "bearer",
  user: CURRENT_USER,
} satisfies AuthLoginBackendResponse;

function createLoginRequest(
  body: BodyInit,
  origin = "https://app.test",
): Request {
  return new Request("https://app.test/api/auth/login", {
    body,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    method: "POST",
  });
}

function createDependencies(
  overrides: Partial<LoginDependencies> = {},
): LoginDependencies {
  return {
    clearSessionToken: vi.fn<LoginDependencies["clearSessionToken"]>()
      .mockResolvedValue(undefined),
    getCurrentUser: vi.fn<LoginDependencies["getCurrentUser"]>()
      .mockResolvedValue({
        status: "authenticated",
        user: CURRENT_USER_WITH_SENSITIVE_EXTRA,
      }),
    login: vi.fn<LoginDependencies["login"]>().mockImplementation(() =>
      Promise.resolve(Response.json(LOGIN_RESPONSE)),
    ),
    setSessionToken: vi.fn<LoginDependencies["setSessionToken"]>()
      .mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleLoginRequest", () => {
  it("reenvía las credenciales validadas, crea la sesión y responde sólo con el usuario seguro", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No debe haber red real"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const dependencies = createDependencies();
    const request = createLoginRequest(
      JSON.stringify({
        email: "  admin@example.com  ",
        password: PASSWORD,
      }),
    );

    const response = await handleLoginRequest(request, dependencies);
    const responseText = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(responseText)).toEqual({ user: CURRENT_USER });
    expect(responseText).not.toContain(TOKEN);
    expect(responseText).not.toContain(PASSWORD);
    expect(responseText).not.toContain("access_token");
    expect(dependencies.login).toHaveBeenCalledOnce();
    expect(dependencies.login).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: PASSWORD,
    });
    expect(dependencies.setSessionToken).toHaveBeenCalledWith(TOKEN);
    expect(dependencies.getCurrentUser).toHaveBeenCalledWith(TOKEN);
    expect(dependencies.clearSessionToken).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    const consoleOutput = JSON.stringify([
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ]);
    expect(consoleOutput).not.toContain(PASSWORD);
    expect(consoleOutput).not.toContain(TOKEN);
  });

  it("normaliza credenciales inválidas sin crear ni validar una cookie", async () => {
    const dependencies = createDependencies({
      login: vi.fn<LoginDependencies["login"]>().mockResolvedValue(
        Response.json(
          { detail: "Credenciales inválidas para admin@example.com" },
          { status: 401 },
        ),
      ),
    });
    const request = createLoginRequest(
      JSON.stringify({ email: "admin@example.com", password: PASSWORD }),
    );

    const response = await handleLoginRequest(request, dependencies);
    const responseText = await response.text();

    expect(response.status).toBe(401);
    expect(JSON.parse(responseText)).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "El correo o la contraseña son incorrectos.",
    });
    expect(responseText).not.toContain("admin@example.com");
    expect(responseText).not.toContain(PASSWORD);
    expect(dependencies.setSessionToken).not.toHaveBeenCalled();
    expect(dependencies.getCurrentUser).not.toHaveBeenCalled();
    expect(dependencies.clearSessionToken).not.toHaveBeenCalled();
  });

  it("devuelve 400 para JSON malformado sin consultar el backend", async () => {
    const dependencies = createDependencies();

    const response = await handleLoginRequest(
      createLoginRequest('{"email":"admin@example.com"'),
      dependencies,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_REQUEST",
    });
    expect(dependencies.login).not.toHaveBeenCalled();
    expect(dependencies.setSessionToken).not.toHaveBeenCalled();
  });

  it.each([
    [{ email: "correo-invalido", password: PASSWORD }, "email"],
    [{ email: "admin@example.com", password: "" }, "password"],
    [{ email: "admin@example.com" }, "password"],
  ])(
    "devuelve 422 para el payload inválido %# sin consultar el backend",
    async (body, invalidField) => {
      const dependencies = createDependencies();

      const response = await handleLoginRequest(
        createLoginRequest(JSON.stringify(body)),
        dependencies,
      );
      const responseBody: unknown = await response.json();

      expect(response.status).toBe(422);
      expect(responseBody).toEqual(
        expect.objectContaining({
          code: "VALIDATION_ERROR",
          details: expect.objectContaining({ [invalidField]: expect.any(Array) }),
        }),
      );
      expect(dependencies.login).not.toHaveBeenCalled();
      expect(dependencies.setSessionToken).not.toHaveBeenCalled();
    },
  );

  it("devuelve 503 controlado ante un fallo de red sin filtrar URL ni crear cookie", async () => {
    const internalUrl = "http://backend.internal:8000/auth/login";
    const dependencies = createDependencies({
      login: vi.fn<LoginDependencies["login"]>().mockRejectedValue(
        new BackendRequestError("network", `Fallo en ${internalUrl}`),
      ),
    });

    const response = await handleLoginRequest(
      createLoginRequest(
        JSON.stringify({ email: "admin@example.com", password: PASSWORD }),
      ),
      dependencies,
    );
    const responseText = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(responseText)).toEqual({
      code: "BACKEND_UNAVAILABLE",
      message: "El servidor no está disponible. Intentá nuevamente.",
    });
    expect(responseText).not.toContain(internalUrl);
    expect(responseText).not.toContain(PASSWORD);
    expect(dependencies.setSessionToken).not.toHaveBeenCalled();
    expect(dependencies.clearSessionToken).not.toHaveBeenCalled();
  });

  it("normaliza un 503 HTTP real del backend sin crear cookie", async () => {
    const dependencies = createDependencies({
      login: vi.fn<LoginDependencies["login"]>().mockResolvedValue(
        Response.json(
          { detail: "Servicio interno no disponible" },
          { status: 503 },
        ),
      ),
    });

    const response = await handleLoginRequest(
      createLoginRequest(
        JSON.stringify({ email: "admin@example.com", password: PASSWORD }),
      ),
      dependencies,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: "BACKEND_UNAVAILABLE",
      message: "El servidor no está disponible. Intentá nuevamente.",
    });
    expect(dependencies.setSessionToken).not.toHaveBeenCalled();
  });

  it("elimina la cookie parcial si /auth/me falla después del login", async () => {
    const dependencies = createDependencies({
      getCurrentUser: vi
        .fn<LoginDependencies["getCurrentUser"]>()
        .mockRejectedValue(
          new BackendRequestError("timeout", "Tiempo de espera interno"),
        ),
    });

    const response = await handleLoginRequest(
      createLoginRequest(
        JSON.stringify({ email: "admin@example.com", password: PASSWORD }),
      ),
      dependencies,
    );

    expect(response.status).toBe(503);
    expect(dependencies.setSessionToken).toHaveBeenCalledWith(TOKEN);
    expect(dependencies.getCurrentUser).toHaveBeenCalledWith(TOKEN);
    expect(dependencies.clearSessionToken).toHaveBeenCalledOnce();
  });

  it("rechaza un Origin externo antes de leer credenciales o tocar la sesión", async () => {
    const dependencies = createDependencies();
    const request = createLoginRequest(
      JSON.stringify({ email: "admin@example.com", password: PASSWORD }),
      "https://externo.test",
    );

    const response = await handleLoginRequest(request, dependencies);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_ORIGIN",
    });
    expect(dependencies.login).not.toHaveBeenCalled();
    expect(dependencies.setSessionToken).not.toHaveBeenCalled();
    expect(dependencies.clearSessionToken).not.toHaveBeenCalled();
  });
});
