import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth/types";
import type { ExecutionRead } from "@/features/executions/types";
import type { ProcessRead } from "@/features/processes/types";
import {
  handleCreateExecutionRequest,
  handleGetExecutionRequest,
  handleGetProcessRequest,
  handleListProcessExecutionsRequest,
  handleListProcessesRequest,
} from "@/lib/api/authenticated-route-handlers";
import { BackendRequestError } from "@/lib/api/server-utils";
import { RequiredSessionError } from "@/lib/auth/session-contract";

type Dependencies = Parameters<typeof handleListProcessesRequest>[1];

const TOKEN = "header.payload.signature";
const CURRENT_USER = {
  cliente_id: 7,
  email: "admin@example.com",
  estado: "ACTIVO",
  id: 12,
  nombre: "Administración",
  rol: "ADMIN",
} satisfies CurrentUser;

const PROCESS = {
  cliente_id: 7,
  created_at: "2026-08-07T12:00:00Z",
  descripcion: "Transformación de planillas",
  estado: "ACTIVO",
  id: 4,
  nombre: "Transformación Excel",
  tipo: "TRANSFORMACION_EXCEL",
  updated_at: null,
} satisfies ProcessRead;

const EXECUTION = {
  created_at: "2026-08-07T12:00:00Z",
  error_message: null,
  estado: "CARGADO",
  finished_at: null,
  id: 31,
  proceso_id: PROCESS.id,
  resumen_json: null,
  started_at: "2026-08-07T12:00:00Z",
  usuario_id: CURRENT_USER.id,
} satisfies ExecutionRead;

function createDependencies(
  overrides: Partial<Dependencies> = {},
): Dependencies {
  return {
    clearSessionToken: vi.fn<Dependencies["clearSessionToken"]>()
      .mockResolvedValue(undefined),
    fetchBackend: vi.fn<Dependencies["fetchBackend"]>().mockResolvedValue(
      Response.json([]),
    ),
    requireSession: vi.fn<Dependencies["requireSession"]>().mockResolvedValue({
      token: TOKEN,
      user: CURRENT_USER,
    }),
    ...overrides,
  };
}

function getRequest(path: string): Request {
  return new Request(`https://app.test${path}`);
}

function createRequest(body: unknown): Request {
  return new Request("https://app.test/api/backend/ejecuciones", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Origin: "https://app.test",
    },
    method: "POST",
  });
}

describe("BFF autenticado de procesos y ejecuciones", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve procesos del cliente de la sesión", async () => {
    const dependencies = createDependencies({
      fetchBackend: vi
        .fn<Dependencies["fetchBackend"]>()
        .mockResolvedValue(Response.json([PROCESS])),
    });

    const response = await handleListProcessesRequest(
      getRequest("/api/backend/procesos"),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual([PROCESS]);
    expect(dependencies.fetchBackend).toHaveBeenCalledWith(
      "/procesos?cliente_id=7",
      TOKEN,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("responde 401 sin sesión y no consulta datos", async () => {
    const dependencies = createDependencies({
      requireSession: vi
        .fn<Dependencies["requireSession"]>()
        .mockRejectedValue(new RequiredSessionError("unauthenticated")),
    });

    const response = await handleListProcessesRequest(
      getRequest("/api/backend/procesos"),
      dependencies,
    );

    expect(response.status).toBe(401);
    expect(dependencies.fetchBackend).not.toHaveBeenCalled();
  });

  it("ignora cliente_id enviado por el navegador", async () => {
    const dependencies = createDependencies({
      fetchBackend: vi
        .fn<Dependencies["fetchBackend"]>()
        .mockResolvedValue(Response.json([PROCESS])),
    });

    await handleListProcessesRequest(
      getRequest("/api/backend/procesos?cliente_id=999"),
      dependencies,
    );

    expect(dependencies.fetchBackend).toHaveBeenCalledWith(
      "/procesos?cliente_id=7",
      TOKEN,
      expect.any(Object),
    );
  });

  it("normaliza un 403 del backend", async () => {
    const dependencies = createDependencies({
      fetchBackend: vi
        .fn<Dependencies["fetchBackend"]>()
        .mockResolvedValue(
          Response.json({ detail: "dato interno" }, { status: 403 }),
        ),
    });

    const response = await handleListProcessesRequest(
      getRequest("/api/backend/procesos"),
      dependencies,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: "FORBIDDEN",
      message: "No tenés permisos para acceder a este recurso.",
    });
  });

  it("normaliza una caída de red como 503", async () => {
    const dependencies = createDependencies({
      fetchBackend: vi
        .fn<Dependencies["fetchBackend"]>()
        .mockRejectedValue(new BackendRequestError("network", "URL interna")),
    });

    const response = await handleListProcessesRequest(
      getRequest("/api/backend/procesos"),
      dependencies,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "BACKEND_UNAVAILABLE",
    });
  });

  it("rechaza procesoId inválido con 400 antes de autenticar", async () => {
    const dependencies = createDependencies();

    const response = await handleListProcessExecutionsRequest(
      "0",
      dependencies,
    );

    expect(response.status).toBe(400);
    expect(dependencies.requireSession).not.toHaveBeenCalled();
    expect(dependencies.fetchBackend).not.toHaveBeenCalled();
  });

  it("lista ejecuciones con el filtro backend real luego de validar el proceso", async () => {
    const fetchBackend = vi
      .fn<Dependencies["fetchBackend"]>()
      .mockResolvedValueOnce(Response.json(PROCESS))
      .mockResolvedValueOnce(Response.json([EXECUTION]));
    const dependencies = createDependencies({ fetchBackend });

    const response = await handleListProcessExecutionsRequest(
      String(PROCESS.id),
      dependencies,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([EXECUTION]);
    expect(fetchBackend).toHaveBeenNthCalledWith(
      2,
      "/ejecuciones?proceso_id=4",
      TOKEN,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("impide leer un proceso de otro cliente", async () => {
    const dependencies = createDependencies({
      fetchBackend: vi
        .fn<Dependencies["fetchBackend"]>()
        .mockResolvedValue(Response.json({ ...PROCESS, cliente_id: 99 })),
    });

    const response = await handleGetProcessRequest("4", dependencies);

    expect(response.status).toBe(403);
  });

  it("crea una ejecución con proceso_id válido y body upstream mínimo", async () => {
    const fetchBackend = vi
      .fn<Dependencies["fetchBackend"]>()
      .mockResolvedValueOnce(Response.json(PROCESS))
      .mockResolvedValueOnce(Response.json(EXECUTION, { status: 201 }));
    const dependencies = createDependencies({ fetchBackend });

    const response = await handleCreateExecutionRequest(
      createRequest({ proceso_id: PROCESS.id }),
      dependencies,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(EXECUTION);
    const createCall = fetchBackend.mock.calls[1];
    expect(createCall[0]).toBe("/ejecuciones");
    expect(createCall[1]).toBe(TOKEN);
    expect(createCall[2]?.method).toBe("POST");
    expect(JSON.parse(String(createCall[2]?.body))).toEqual({ proceso_id: 4 });
  });

  it.each([
    { proceso_id: 4, usuario_id: 999 },
    { estado: "COMPLETADO", proceso_id: 4 },
  ])("rechaza campos controlados por servidor: %#", async (body) => {
    const dependencies = createDependencies();

    const response = await handleCreateExecutionRequest(
      createRequest(body),
      dependencies,
    );

    expect(response.status).toBe(422);
    expect(dependencies.requireSession).not.toHaveBeenCalled();
    expect(dependencies.fetchBackend).not.toHaveBeenCalled();
  });

  it("preserva 404 normalizado para una ejecución inexistente", async () => {
    const dependencies = createDependencies({
      fetchBackend: vi
        .fn<Dependencies["fetchBackend"]>()
        .mockResolvedValue(Response.json({ detail: "no existe" }, { status: 404 })),
    });

    const response = await handleGetExecutionRequest("999", dependencies);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "El recurso solicitado no existe.",
    });
  });

  it("convierte un 401 upstream en SESSION_EXPIRED y limpia la cookie", async () => {
    const dependencies = createDependencies({
      fetchBackend: vi
        .fn<Dependencies["fetchBackend"]>()
        .mockResolvedValue(Response.json({ detail: "token" }, { status: 401 })),
    });

    const response = await handleGetExecutionRequest("31", dependencies);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "SESSION_EXPIRED",
      message: "Tu sesión no es válida o ha vencido.",
    });
    expect(dependencies.clearSessionToken).toHaveBeenCalledOnce();
  });
});
