import { describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth/types";
import {
  handleApplyTransformationTemplateRequest,
  handleCreateTransformationTemplateRequest,
  handleDeactivateTransformationTemplateRequest,
  handleListTransformationTemplatesRequest,
  handleUpdateTransformationTemplateRequest,
} from "@/lib/api/authenticated-route-handlers";

type Dependencies = Parameters<typeof handleListTransformationTemplatesRequest>[1];

const ADMIN = {
  cliente_id: 7,
  email: "admin@example.com",
  estado: "ACTIVO",
  id: 12,
  nombre: "Administración",
  rol: "ADMIN",
} satisfies CurrentUser;

const TEMPLATE = {
  activo: true,
  configuracion: { output_columns: [{}], source: { header_row: 1 } },
  created_at: "2026-09-20T12:00:00Z",
  descripcion: "Mensual",
  id: 9,
  nombre: "Ventas",
  proceso_id: 4,
  schema_version: 1,
  updated_at: null,
};

const SUMMARY = { ejecucion_id: 31, proceso_id: 4 };

function dependencies(user: CurrentUser = ADMIN): Dependencies {
  return {
    clearSessionToken: vi.fn().mockResolvedValue(undefined),
    fetchBackend: vi.fn(async (path: string, _token: string, options?: { method?: string }) => {
      if (path === "/transformaciones-excel/31/resumen") return Response.json(SUMMARY);
      if (path === "/transformaciones-excel/procesos/4/plantillas") return Response.json({ items: [TEMPLATE], total: 1 });
      if (path === "/transformaciones-excel/plantillas/9" && options?.method === "GET") return Response.json(TEMPLATE);
      if (path === "/transformaciones-excel/31/plantillas") return Response.json(TEMPLATE, { status: 201 });
      if (path.endsWith("/aplicar")) return Response.json({ configuracion: {}, ejecucion_id: 31, estado_ejecucion: "CONFIGURADO", updated_at: null });
      if (path === "/transformaciones-excel/plantillas/9" && options?.method === "PUT") return Response.json({ ...TEMPLATE, nombre: "Nuevo" });
      if (path === "/transformaciones-excel/plantillas/9" && options?.method === "DELETE") return new Response(null, { status: 204 });
      return Response.json({}, { status: 500 });
    }),
    requireSession: vi.fn().mockResolvedValue({ token: "header.payload.signature", user }),
  } as Dependencies;
}

function mutationRequest(path: string, body?: unknown, method = "POST") {
  return new Request(`http://localhost${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    method,
  });
}

describe("BFF de plantillas de transformación", () => {
  it("deriva el proceso desde la ejecución y lista sólo plantillas activas del contrato", async () => {
    const deps = dependencies();
    const response = await handleListTransformationTemplatesRequest("31", deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [TEMPLATE], total: 1 });
    expect(deps.fetchBackend).toHaveBeenNthCalledWith(
      2,
      "/transformaciones-excel/procesos/4/plantillas",
      "header.payload.signature",
      { headers: { Accept: "application/json" }, method: "GET" },
    );
  });

  it("crea con payload normalizado y sin cliente_id", async () => {
    const deps = dependencies();
    const response = await handleCreateTransformationTemplateRequest(
      mutationRequest("/api/backend/transformaciones/31/plantillas", { nombre: " Ventas ", descripcion: " Mensual " }),
      "31",
      deps,
    );
    expect(response.status).toBe(201);
    expect(deps.fetchBackend).toHaveBeenLastCalledWith(
      "/transformaciones-excel/31/plantillas",
      "header.payload.signature",
      {
        body: JSON.stringify({ nombre: "Ventas", descripcion: "Mensual" }),
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        method: "POST",
      },
    );
    expect(JSON.stringify(vi.mocked(deps.fetchBackend).mock.calls)).not.toContain("cliente_id");
  });

  it("aplica sólo una plantilla del mismo proceso y reenvía la fuente actual", async () => {
    const deps = dependencies();
    const response = await handleApplyTransformationTemplateRequest(
      mutationRequest("/api/backend/transformaciones/31/plantillas/9/aplicar", { archivo_id: 8, header_row: 2, sheet_name: "Datos" }),
      "31",
      "9",
      deps,
    );
    expect(response.status).toBe(200);
    expect(deps.fetchBackend).toHaveBeenLastCalledWith(
      "/transformaciones-excel/31/plantillas/9/aplicar",
      "header.payload.signature",
      {
        body: JSON.stringify({ archivo_id: 8, sheet_name: "Datos", header_row: 2 }),
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        method: "POST",
      },
    );
  });

  it("rechaza en el BFF una plantilla que no pertenece al proceso de la ejecución", async () => {
    const deps = dependencies();
    vi.mocked(deps.fetchBackend).mockImplementation(async (path: string) => {
      if (path.endsWith("/resumen")) return Response.json(SUMMARY);
      return Response.json({ ...TEMPLATE, proceso_id: 99 });
    });
    const response = await handleApplyTransformationTemplateRequest(
      mutationRequest("/api/backend/transformaciones/31/plantillas/9/aplicar", { archivo_id: 8 }),
      "31",
      "9",
      deps,
    );
    expect(response.status).toBe(404);
    expect(deps.fetchBackend).toHaveBeenCalledTimes(2);
  });

  it("exige ADMIN para crear, editar y desactivar", async () => {
    const deps = dependencies({ ...ADMIN, rol: "OPERADOR" });
    const createResponse = await handleCreateTransformationTemplateRequest(
      mutationRequest("/api/backend/transformaciones/31/plantillas", { nombre: "Ventas" }), "31", deps,
    );
    const updateResponse = await handleUpdateTransformationTemplateRequest(
      mutationRequest("/api/backend/transformaciones/31/plantillas/9", { nombre: "Nuevo" }, "PUT"), "31", "9", deps,
    );
    const deleteResponse = await handleDeactivateTransformationTemplateRequest(
      mutationRequest("/api/backend/transformaciones/31/plantillas/9", undefined, "DELETE"), "31", "9", deps,
    );
    expect([createResponse.status, updateResponse.status, deleteResponse.status]).toEqual([403, 403, 403]);
    expect(deps.fetchBackend).not.toHaveBeenCalled();
  });

  it("actualiza metadata y desactiva mediante soft-delete", async () => {
    const deps = dependencies();
    const updateResponse = await handleUpdateTransformationTemplateRequest(
      mutationRequest("/api/backend/transformaciones/31/plantillas/9", { nombre: "Nuevo", descripcion: null }, "PUT"),
      "31", "9", deps,
    );
    expect(updateResponse.status).toBe(200);
    const deleteResponse = await handleDeactivateTransformationTemplateRequest(
      mutationRequest("/api/backend/transformaciones/31/plantillas/9", undefined, "DELETE"),
      "31", "9", deps,
    );
    expect(deleteResponse.status).toBe(204);
    expect(await deleteResponse.text()).toBe("");
  });

  it("rechaza mutaciones cross-origin antes de resolver la sesión", async () => {
    const deps = dependencies();
    const response = await handleCreateTransformationTemplateRequest(
      new Request("http://localhost/api/backend/transformaciones/31/plantillas", {
        body: JSON.stringify({ nombre: "Ventas" }),
        headers: { Origin: "https://attacker.example" },
        method: "POST",
      }),
      "31",
      deps,
    );
    expect(response.status).toBe(403);
    expect(deps.requireSession).not.toHaveBeenCalled();
  });
});
