import { describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth/types";
import {
  handleApproveConciliationRequest,
  handleExportConciliationRequest,
  handleRejectConciliationRequest,
} from "@/lib/api/authenticated-route-handlers";

type Dependencies = Parameters<typeof handleApproveConciliationRequest>[2];

const TOKEN = "header.payload.signature";
const USER = {
  cliente_id: 7,
  email: "admin@example.com",
  estado: "ACTIVO",
  id: 12,
  nombre: "Administración",
  rol: "ADMIN",
} satisfies CurrentUser;
const EXECUTION = {
  created_at: "2026-09-28T12:00:00Z",
  error_message: null,
  estado: "REQUIERE_REVISION",
  finished_at: "2026-09-28T12:00:00Z",
  id: 31,
  proceso_id: 4,
  resumen_json: {},
  started_at: "2026-09-28T11:00:00Z",
  usuario_id: USER.id,
};
const PROCESS = {
  cliente_id: USER.cliente_id,
  created_at: "2026-09-28T10:00:00Z",
  descripcion: null,
  estado: "ACTIVO",
  id: 4,
  nombre: "Conciliación bancaria",
  tipo: "CONCILIACION_EXCEL",
  updated_at: null,
};
const SUMMARY = {
  conciliados: 1,
  diferencias_importe: 1,
  duplicados_archivo_a: 0,
  duplicados_archivo_b: 0,
  ejecucion_id: 31,
  errores_formato: 0,
  estado_ejecucion: "APROBADO",
  pendientes_revision: 0,
  revisados: 2,
  solo_archivo_a: 0,
  solo_archivo_b: 0,
  total_resultados: 2,
};

function createDependencies(responses: Response[]): Dependencies {
  return {
    clearSessionToken: vi.fn<Dependencies["clearSessionToken"]>().mockResolvedValue(undefined),
    fetchBackend: vi.fn<Dependencies["fetchBackend"]>()
      .mockImplementation(async () => responses.shift() ?? Response.json({})),
    requireSession: vi.fn<Dependencies["requireSession"]>().mockResolvedValue({
      token: TOKEN,
      user: USER,
    }),
  };
}

function postRequest(path: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      Origin: "http://localhost",
    },
    method: "POST",
  });
}

describe("conciliation closure route handlers", () => {
  it("aprueba mediante el backend autenticado y devuelve el resumen validado", async () => {
    const dependencies = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json(SUMMARY),
    ]);
    const response = await handleApproveConciliationRequest(
      postRequest("/api/backend/conciliaciones/31/aprobar"),
      "31",
      dependencies,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(SUMMARY);
    expect(dependencies.fetchBackend).toHaveBeenLastCalledWith(
      "/conciliaciones/31/aprobar",
      TOKEN,
      { headers: { Accept: "application/json" }, method: "POST" },
    );
  });

  it("rechaza reenviando exactamente el motivo y propaga conflictos", async () => {
    const dependencies = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json({ detail: "Estado terminal" }, { status: 409 }),
    ]);
    const response = await handleRejectConciliationRequest(
      postRequest("/api/backend/conciliaciones/31/rechazar", {
        motivo: "Comprobante inválido",
      }),
      "31",
      dependencies,
    );

    expect(response.status).toBe(409);
    expect(dependencies.fetchBackend).toHaveBeenLastCalledWith(
      "/conciliaciones/31/rechazar",
      TOKEN,
      {
        body: JSON.stringify({ motivo: "Comprobante inválido" }),
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        method: "POST",
      },
    );
  });

  it("no reenvía decisiones con origen o payload inválido", async () => {
    const dependencies = createDependencies([]);
    const invalidOrigin = new Request(
      "http://localhost/api/backend/conciliaciones/31/aprobar",
      { headers: { Origin: "https://attacker.example" }, method: "POST" },
    );
    expect((await handleApproveConciliationRequest(invalidOrigin, "31", dependencies)).status).toBe(403);

    const invalidPayload = postRequest(
      "/api/backend/conciliaciones/31/rechazar",
      { comentario: "campo inventado" },
    );
    expect((await handleRejectConciliationRequest(invalidPayload, "31", dependencies)).status).toBe(422);
    expect(dependencies.fetchBackend).not.toHaveBeenCalled();
  });

  it("transmite el XLSX preservando nombre, tipo y protecciones", async () => {
    const file = new Uint8Array([80, 75, 3, 4]);
    const dependencies = createDependencies([
      Response.json({ ...EXECUTION, estado: "APROBADO" }),
      Response.json(PROCESS),
      new Response(file, {
        headers: {
          "Content-Disposition": "attachment; filename=conciliacion_ejecucion_31.xlsx",
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      }),
    ]);
    const response = await handleExportConciliationRequest("31", dependencies);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("content-disposition")).toContain("conciliacion_ejecucion_31.xlsx");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(file));
  });
});
