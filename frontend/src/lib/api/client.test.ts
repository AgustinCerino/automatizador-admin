import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch, assertInternalApiPath } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

describe("assertInternalApiPath", () => {
  it("acepta rutas internas bajo /api/", () => {
    expect(() => assertInternalApiPath("/api/backend/health")).not.toThrow();
  });

  it.each([
    "https://example.com/api/health",
    "//example.com/api/health",
    "/api/../health",
    "/health",
    "/api/\\backend",
  ])("rechaza el destino no permitido %s", (path) => {
    expect(() => assertInternalApiPath(path)).toThrow(TypeError);
  });
});

describe("apiFetch", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function lastRequestInit(): RequestInit {
    const requestInit = fetchMock.mock.calls.at(-1)?.[1];
    expect(requestInit).toBeDefined();
    return requestInit ?? {};
  }

  it("usa credenciales same-origin y Accept JSON por defecto", async () => {
    fetchMock.mockResolvedValue(new Response('{"status":"ok"}'));

    await apiFetch("/api/backend/health");

    const requestInit = lastRequestInit();
    const headers = new Headers(requestInit.headers);
    expect(requestInit.credentials).toBe("same-origin");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("serializa cuerpos JSON y agrega su Content-Type", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));

    await apiFetch("/api/items", {
      body: { name: "Informe" },
      method: "POST",
    });

    const requestInit = lastRequestInit();
    expect(requestInit.body).toBe('{"name":"Informe"}');
    expect(new Headers(requestInit.headers).get("content-type")).toBe(
      "application/json",
    );
  });

  it("no sobrescribe un Content-Type JSON provisto", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));

    await apiFetch("/api/items", {
      body: { name: "Informe" },
      headers: { "Content-Type": "application/merge-patch+json" },
      method: "PATCH",
    });

    expect(new Headers(lastRequestInit().headers).get("content-type")).toBe(
      "application/merge-patch+json",
    );
  });

  it("envía FormData sin fijar Content-Type", async () => {
    const formData = new FormData();
    formData.set("file", "contenido");
    fetchMock.mockResolvedValue(new Response("{}"));

    await apiFetch("/api/upload", { body: formData, method: "POST" });

    const requestInit = lastRequestInit();
    expect(requestInit.body).toBe(formData);
    expect(new Headers(requestInit.headers).has("content-type")).toBe(false);
  });

  it("envía Blob sin serializarlo como JSON", async () => {
    const blob = new Blob(["contenido"], { type: "text/plain" });
    fetchMock.mockResolvedValue(new Response("{}"));

    await apiFetch("/api/upload", { body: blob, method: "POST" });

    const requestInit = lastRequestInit();
    expect(requestInit.body).toBe(blob);
    expect(new Headers(requestInit.headers).has("content-type")).toBe(false);
  });

  it("envía texto sin serializarlo como JSON", async () => {
    fetchMock.mockResolvedValue(new Response("{}"));

    await apiFetch("/api/text", { body: "contenido", method: "POST" });

    const requestInit = lastRequestInit();
    expect(requestInit.body).toBe("contenido");
    expect(new Headers(requestInit.headers).has("content-type")).toBe(false);
  });

  it("preserva headers, método y señal del llamador", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(new Response("{}"));

    await apiFetch("/api/items", {
      headers: { "X-Request-Id": "request-1" },
      method: "DELETE",
      signal: controller.signal,
    });

    const requestInit = lastRequestInit();
    expect(requestInit.method).toBe("DELETE");
    expect(requestInit.signal).toBe(controller.signal);
    expect(new Headers(requestInit.headers).get("x-request-id")).toBe(
      "request-1",
    );
  });

  it.each([204, 205])("maneja sin parsear la respuesta vacía %i", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));

    await expect(apiFetch("/api/items")).resolves.toBeUndefined();
  });

  it("maneja un JSON vacío sin fallar", async () => {
    fetchMock.mockResolvedValue(
      new Response("", { headers: { "Content-Type": "application/json" } }),
    );

    await expect(apiFetch("/api/items")).resolves.toBeUndefined();
  });

  it("devuelve una respuesta JSON tipada", async () => {
    fetchMock.mockResolvedValue(new Response('{"status":"ok"}'));

    await expect(
      apiFetch<{ status: string }>("/api/backend/health"),
    ).resolves.toEqual({ status: "ok" });
  });

  it("devuelve texto cuando se solicita", async () => {
    fetchMock.mockResolvedValue(new Response("contenido"));

    await expect(
      apiFetch<string>("/api/text", { responseType: "text" }),
    ).resolves.toBe("contenido");
  });

  it("devuelve Blob cuando se solicita", async () => {
    fetchMock.mockResolvedValue(new Response("contenido"));

    const result = await apiFetch<Blob>("/api/file", { responseType: "blob" });

    expect(result).toBeInstanceOf(Blob);
  });

  it("ignora el cuerpo cuando responseType es void", async () => {
    fetchMock.mockResolvedValue(new Response("contenido"));

    await expect(
      apiFetch<void>("/api/items", { responseType: "void" }),
    ).resolves.toBeUndefined();
  });

  it("convierte respuestas HTTP fallidas en ApiError", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "BACKEND_UNAVAILABLE",
          message: "El servidor de la aplicación no está disponible.",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 503,
        },
      ),
    );

    await expect(apiFetch("/api/backend/health")).rejects.toMatchObject({
      code: "BACKEND_UNAVAILABLE",
      message: "El servidor de la aplicación no está disponible.",
      name: "ApiError",
      status: 503,
    });
  });

  it("convierte JSON exitoso inválido en un ApiError controlado", async () => {
    fetchMock.mockResolvedValue(
      new Response("{invalid", {
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(apiFetch("/api/items")).rejects.toEqual(
      expect.objectContaining<ApiError>({
        code: "INVALID_RESPONSE",
        message: "La respuesta del servidor no es válida.",
        name: "ApiError",
        status: 200,
      }),
    );
  });
});
