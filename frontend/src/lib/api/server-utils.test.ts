import { afterEach, describe, expect, it, vi } from "vitest";

import { handleHealthRequest } from "@/lib/api/health-route";
import {
  BackendRequestError,
  createBackendRequestUrl,
  executeBackendRequest,
  executeBackendRequestWithToken,
  forwardBackendResponse,
  getBackendBaseUrl,
  type FetchImplementation,
} from "@/lib/api/server-utils";

describe("configuración y rutas del backend", () => {
  it.each([
    ["http://backend.test", "http://backend.test/"],
    [" https://backend.test:8443/ ", "https://backend.test:8443/"],
  ])("acepta una URL base HTTP(S) válida", (rawUrl, expectedUrl) => {
    expect(getBackendBaseUrl(rawUrl).toString()).toBe(expectedUrl);
  });

  it.each([
    undefined,
    "",
    "backend.test",
    "ftp://backend.test",
    "http://user:password@backend.test",
    "http://backend.test/base",
    "http://backend.test/?target=other",
  ])("rechaza una configuración no permitida", (rawUrl) => {
    expect(() => getBackendBaseUrl(rawUrl)).toThrow(
      expect.objectContaining({ kind: "configuration" }),
    );
  });

  it("construye una URL que permanece en el origen configurado", () => {
    expect(
      createBackendRequestUrl(
        "http://backend.test:8000",
        "/health?verbose=false",
      ).toString(),
    ).toBe("http://backend.test:8000/health?verbose=false");
  });

  it.each([
    "health",
    "//other.test/health",
    "/../health",
    "/%2e%2e/health",
    "/health\\other",
  ])("rechaza la ruta de backend no permitida %s", (backendPath) => {
    expect(() =>
      createBackendRequestUrl("http://backend.test", backendPath),
    ).toThrow(expect.objectContaining({ kind: "configuration" }));
  });
});

describe("forwardBackendResponse", () => {
  it("preserva estado, cuerpo y Content-Type sin convertir JSON", async () => {
    const forwarded = forwardBackendResponse(
      new Response('{"status":"ok"}', {
        headers: { "Content-Type": "application/json; charset=utf-8" },
        status: 202,
      }),
    );

    expect(forwarded.status).toBe(202);
    expect(forwarded.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    await expect(forwarded.text()).resolves.toBe('{"status":"ok"}');
  });

  it("preserva Content-Disposition seguro y Cache-Control", () => {
    const forwarded = forwardBackendResponse(
      new Response("file", {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": 'attachment; filename="report.csv"',
        },
      }),
    );

    expect(forwarded.headers.get("cache-control")).toBe("private, no-store");
    expect(forwarded.headers.get("content-disposition")).toBe(
      'attachment; filename="report.csv"',
    );
  });

  it("permite imponer Cache-Control no-store", () => {
    const forwarded = forwardBackendResponse(
      new Response("ok", { headers: { "Cache-Control": "public" } }),
      { cacheControl: "no-store" },
    );

    expect(forwarded.headers.get("cache-control")).toBe("no-store");
  });

  it("no reenvía headers sensibles, internos o arbitrarios", () => {
    const forwarded = forwardBackendResponse(
      new Response("ok", {
        headers: {
          Authorization: "Bearer secret",
          "Proxy-Authenticate": "Basic",
          Server: "internal-server",
          "Set-Cookie": "session=secret",
          "X-Internal-Route": "/health",
          "X-Powered-By": "framework",
        },
      }),
    );

    expect([...forwarded.headers.keys()]).toEqual(["content-type"]);
    expect(forwarded.headers.get("content-type")).toBe(
      "text/plain;charset=UTF-8",
    );
    expect(forwarded.headers.has("authorization")).toBe(false);
    expect(forwarded.headers.has("proxy-authenticate")).toBe(false);
    expect(forwarded.headers.has("server")).toBe(false);
    expect(forwarded.headers.has("set-cookie")).toBe(false);
    expect(forwarded.headers.has("x-internal-route")).toBe(false);
    expect(forwarded.headers.has("x-powered-by")).toBe(false);
  });

  it("descarta un Content-Disposition que no es de descarga o vista", () => {
    const forwarded = forwardBackendResponse(
      new Response("ok", {
        headers: { "Content-Disposition": "form-data; name=file" },
      }),
    );

    expect(forwarded.headers.has("content-disposition")).toBe(false);
  });

  it("reenvía contenido binario sin transformarlo", async () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const forwarded = forwardBackendResponse(new Response(bytes));

    expect(new Uint8Array(await forwarded.arrayBuffer())).toEqual(bytes);
  });

  it("reenvía respuestas vacías", async () => {
    const forwarded = forwardBackendResponse(
      new Response(null, { status: 204 }),
    );

    expect(forwarded.status).toBe(204);
    await expect(forwarded.text()).resolves.toBe("");
  });
});

describe("executeBackendRequest", () => {
  it("usa fetch del servidor con redirect manual, no-store y URL controlada", async () => {
    const fetchImplementation = vi
      .fn<FetchImplementation>()
      .mockResolvedValue(new Response("ok"));

    await executeBackendRequest(
      "http://backend.test:8000",
      "/health",
      { headers: { "X-Request-Id": "request-1" } },
      fetchImplementation,
    );

    const [url, init] = fetchImplementation.mock.calls[0];
    expect(url.toString()).toBe("http://backend.test:8000/health");
    expect(init?.cache).toBe("no-store");
    expect(init?.redirect).toBe("manual");
    expect(new Headers(init?.headers).get("x-request-id")).toBe("request-1");
  });

  it("elimina credenciales y autorización de los headers salientes", async () => {
    const fetchImplementation = vi
      .fn<FetchImplementation>()
      .mockResolvedValue(new Response("ok"));

    await executeBackendRequest(
      "http://backend.test",
      "/health",
      {
        headers: {
          Authorization: "Bearer secret",
          Cookie: "session=secret",
          "Proxy-Authorization": "Basic secret",
        },
      },
      fetchImplementation,
    );

    const headers = new Headers(fetchImplementation.mock.calls[0][1]?.headers);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("proxy-authorization")).toBe(false);
  });

  it("distingue una conexión rechazada", async () => {
    const failure = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ECONNREFUSED" },
    });
    const fetchImplementation = vi
      .fn<FetchImplementation>()
      .mockRejectedValue(failure);

    await expect(
      executeBackendRequest(
        "http://backend.test",
        "/health",
        {},
        fetchImplementation,
      ),
    ).rejects.toMatchObject({ kind: "connection-refused" });
  });

  it("distingue un error de red", async () => {
    const fetchImplementation = vi
      .fn<FetchImplementation>()
      .mockRejectedValue(new TypeError("fetch failed"));

    await expect(
      executeBackendRequest(
        "http://backend.test",
        "/health",
        {},
        fetchImplementation,
      ),
    ).rejects.toMatchObject({ kind: "network" });
  });

  it("distingue un timeout y aborta la solicitud", async () => {
    const fetchImplementation: FetchImplementation = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });

    await expect(
      executeBackendRequest(
        "http://backend.test",
        "/health",
        { timeoutMs: 5 },
        fetchImplementation,
      ),
    ).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("executeBackendRequestWithToken", () => {
  it("impone el Bearer confiable, conserva headers permitidos y fuerza no-store", async () => {
    const fetchImplementation = vi
      .fn<FetchImplementation>()
      .mockResolvedValue(new Response("ok"));

    await executeBackendRequestWithToken(
      "http://backend.test:8000",
      "/auth/me",
      "trusted.jwt.token",
      {
        cache: "force-cache",
        headers: {
          Authorization: "Bearer token-controlado-por-caller",
          Cookie: "session=no-debe-salir",
          "X-Request-Id": "request-1",
        },
      },
      fetchImplementation,
    );

    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [url, init] = fetchImplementation.mock.calls[0];
    const headers = new Headers(init?.headers);

    expect(url.toString()).toBe("http://backend.test:8000/auth/me");
    expect(init?.cache).toBe("no-store");
    expect(init?.redirect).toBe("manual");
    expect(headers.get("authorization")).toBe("Bearer trusted.jwt.token");
    expect(headers.get("x-request-id")).toBe("request-1");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.get("authorization")).not.toContain(
      "token-controlado-por-caller",
    );
  });

  it.each(["", " token", "token ", "token\r\ninyectado"])(
    "rechaza el token no permitido %# sin invocar fetch",
    async (token) => {
      const fetchImplementation = vi
        .fn<FetchImplementation>()
        .mockResolvedValue(new Response("ok"));

      await expect(
        executeBackendRequestWithToken(
          "http://backend.test",
          "/auth/me",
          token,
          {},
          fetchImplementation,
        ),
      ).rejects.toMatchObject({ kind: "configuration" });

      expect(fetchImplementation).not.toHaveBeenCalled();
    },
  );
});

describe("handleHealthRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("consulta únicamente /health sin caché", async () => {
    const fetchBackend = vi.fn().mockResolvedValue(
      new Response('{"status":"ok"}', {
        headers: { "Content-Type": "application/json" },
      }),
    );

    await handleHealthRequest(fetchBackend);

    expect(fetchBackend).toHaveBeenCalledOnce();
    expect(fetchBackend).toHaveBeenCalledWith("/health", {
      cache: "no-store",
    });
  });

  it("reenvía la respuesta real y fuerza no-store", async () => {
    const response = await handleHealthRequest(() =>
      Promise.resolve(
        new Response('{"status":"ok"}', {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it.each(["network", "timeout", "connection-refused"] as const)(
    "devuelve el contrato 503 para %s",
    async (kind) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await handleHealthRequest(() =>
        Promise.reject(new BackendRequestError(kind, "diagnóstico interno")),
      );

      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({
        code: "BACKEND_UNAVAILABLE",
        message: "El servidor de la aplicación no está disponible.",
      });
    },
  );

  it("devuelve un 500 genérico para configuración inválida", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await handleHealthRequest(() =>
      Promise.reject(
        new BackendRequestError(
          "configuration",
          "BACKEND_URL=http://internal:8000",
        ),
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toBe(
      '{"code":"INTERNAL_SERVER_ERROR","message":"Ocurrió un error interno. Intentá nuevamente."}',
    );
    expect(body).not.toContain("internal:8000");
    expect(body).not.toContain("BACKEND_URL");
  });

  it("devuelve un 500 genérico para errores inesperados", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await handleHealthRequest(() =>
      Promise.reject(new Error("unexpected internal value")),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error interno. Intentá nuevamente.",
    });
  });
});
