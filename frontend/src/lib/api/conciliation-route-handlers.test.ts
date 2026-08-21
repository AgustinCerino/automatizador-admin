import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth/types";
import {
  handleGetConciliationMappingRequest,
  handleGetConciliationPreviewRequest,
  handleGetConciliationSelectionRequest,
  handleListConciliationFilesRequest,
  handleSaveConciliationSelectionRequest,
  handleSaveConciliationMappingRequest,
  handleUploadConciliationFileRequest,
} from "@/lib/api/authenticated-route-handlers";

type Dependencies = Parameters<typeof handleListConciliationFilesRequest>[1];

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
  created_at: "2026-08-21T12:00:00Z",
  error_message: null,
  estado: "CARGADO",
  finished_at: null,
  id: 31,
  proceso_id: 4,
  resumen_json: null,
  started_at: "2026-08-21T12:00:00Z",
  usuario_id: USER.id,
};
const PROCESS = {
  cliente_id: USER.cliente_id,
  created_at: "2026-08-21T12:00:00Z",
  descripcion: null,
  estado: "ACTIVO",
  id: 4,
  nombre: "Conciliación bancaria",
  tipo: "CONCILIACION_EXCEL",
  updated_at: null,
};
const FILE = {
  checksum: "secret-checksum",
  ejecucion_id: EXECUTION.id,
  extension: ".csv",
  id: 8,
  mime_type: "text/csv",
  nombre_original: "sistema.csv",
  ruta_storage: "/private/storage/sistema.csv",
  size_bytes: 120,
  tipo_archivo: "ENTRADA_CONCILIACION",
  uploaded_at: "2026-08-21T12:00:00Z",
};
const MAPPING = {
  archivo_a_id: 8,
  archivo_b_id: 9,
  columna_clave_archivo_a: "Factura",
  columna_clave_archivo_b: "Comprobante",
  columna_importe_archivo_a: "Importe",
  columna_importe_archivo_b: "Monto",
  columnas_archivo_a: ["Factura", "Importe"],
  columnas_archivo_b: ["Comprobante", "Monto"],
  detectar_duplicados: true,
  tolerancia_importe: 0,
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

function writeRequest(body: unknown, method = "PUT"): Request {
  return new Request("http://localhost/api/backend/conciliaciones/31/archivos", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    method,
  });
}

function mappingRequest(body: unknown): Request {
  return new Request("http://localhost/api/backend/conciliaciones/31/mapping", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    method: "POST",
  });
}

function uploadRequest(file: File): Request {
  const data = new FormData();
  data.append("file", file);
  return {
    formData: vi.fn().mockResolvedValue(data),
    headers: new Headers({ Origin: "http://localhost" }),
    url: "http://localhost/api/backend/conciliaciones/31/archivos-disponibles",
  } as unknown as Request;
}

describe("BFF de archivos de conciliación", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("valida el proceso, filtra formatos y elimina storage/checksum", async () => {
    const dependencies = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json([FILE, { ...FILE, id: 9, extension: ".pdf" }]),
    ]);
    const response = await handleListConciliationFilesRequest("31", dependencies);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toHaveLength(1);
    expect(payload[0]).not.toHaveProperty("ruta_storage");
    expect(payload[0]).not.toHaveProperty("checksum");
    expect(dependencies.fetchBackend).toHaveBeenNthCalledWith(
      3,
      "/archivos/ejecucion/31",
      TOKEN,
      { headers: { Accept: "application/json" }, method: "GET" },
    );
  });

  it("rechaza una ejecución de otro tipo antes de listar archivos", async () => {
    const dependencies = createDependencies([
      Response.json(EXECUTION),
      Response.json({ ...PROCESS, tipo: "TRANSFORMACION_EXCEL" }),
    ]);
    const response = await handleListConciliationFilesRequest("31", dependencies);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INCOMPATIBLE_CONCILIATION",
    });
    expect(dependencies.fetchBackend).toHaveBeenCalledTimes(2);
  });

  it("carga un formato compatible con tipo neutral, nunca con rol A/B", async () => {
    const dependencies = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json(FILE, { status: 201 }),
    ]);
    const response = await handleUploadConciliationFileRequest(
      uploadRequest(new File(["a,b"], "sistema.csv")),
      "31",
      dependencies,
    );
    expect(response.status).toBe(201);
    const uploadCall = vi.mocked(dependencies.fetchBackend).mock.calls[2];
    const forwarded = uploadCall[2]?.body as FormData;
    expect(uploadCall[0]).toBe("/archivos/upload");
    expect(forwarded.get("tipo_archivo")).toBe("ENTRADA_CONCILIACION");
    expect(forwarded.get("tipo_archivo")).not.toBe("ARCHIVO_A");
    expect(forwarded.get("tipo_archivo")).not.toBe("ARCHIVO_B");
  });

  it("recupera la selección persistida y distingue el 404 vacío", async () => {
    const selected = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json({ archivo_a_id: 8, archivo_b_id: 9 }),
    ]);
    await expect(
      (await handleGetConciliationSelectionRequest("31", selected)).json(),
    ).resolves.toEqual({ archivo_a_id: 8, archivo_b_id: 9 });

    const empty = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json({ detail: "sin selección" }, { status: 404 }),
    ]);
    const response = await handleGetConciliationSelectionRequest("31", empty);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "CONCILIATION_SELECTION_NOT_FOUND",
    });
  });

  it("guarda el par exacto y rechaza A igual a B antes del backend", async () => {
    const dependencies = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json({ archivo_a_id: 8, archivo_b_id: 9 }),
    ]);
    const response = await handleSaveConciliationSelectionRequest(
      writeRequest({ archivo_a_id: 8, archivo_b_id: 9 }),
      "31",
      dependencies,
    );
    expect(response.status).toBe(200);
    const saveCall = vi.mocked(dependencies.fetchBackend).mock.calls[2];
    expect(saveCall[0]).toBe("/conciliaciones/31/archivos");
    expect(JSON.parse(String(saveCall[2]?.body))).toEqual({
      archivo_a_id: 8,
      archivo_b_id: 9,
    });

    const invalidDependencies = createDependencies([]);
    const invalid = await handleSaveConciliationSelectionRequest(
      writeRequest({ archivo_a_id: 8, archivo_b_id: 8 }),
      "31",
      invalidDependencies,
    );
    expect(invalid.status).toBe(422);
    expect(invalidDependencies.fetchBackend).not.toHaveBeenCalled();
  });

  it("verifica pertenencia antes de solicitar un preview dinámico", async () => {
    const preview = {
      archivo_id: 8,
      columns: ["Factura", "Total"],
      extension: ".csv",
      nombre_original: "sistema.csv",
      preview_limit: 20,
      rows: [{ Factura: "F-1", Total: 12 }],
      total_rows: 1,
    };
    const dependencies = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json([FILE]),
      Response.json(preview),
    ]);
    const response = await handleGetConciliationPreviewRequest("31", "8", dependencies);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(preview);
    expect(dependencies.fetchBackend).toHaveBeenNthCalledWith(
      4,
      "/archivos/8/preview?limit=20",
      TOKEN,
      { headers: { Accept: "application/json" }, method: "GET" },
    );
  });

  it("recupera el mapping persistido y distingue su ausencia", async () => {
    const selected = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json(MAPPING),
    ]);
    await expect(
      (await handleGetConciliationMappingRequest("31", selected)).json(),
    ).resolves.toEqual(MAPPING);

    const empty = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json({}, { status: 404 }),
    ]);
    const response = await handleGetConciliationMappingRequest("31", empty);
    await expect(response.json()).resolves.toMatchObject({
      code: "CONCILIATION_MAPPING_NOT_FOUND",
    });
  });

  it("guarda el contrato exacto y rechaza un mapping incompleto", async () => {
    const dependencies = createDependencies([
      Response.json(EXECUTION),
      Response.json(PROCESS),
      Response.json(MAPPING),
    ]);
    const payload = {
      archivo_a_id: 8,
      archivo_b_id: 9,
      columna_clave_archivo_a: "Factura",
      columna_clave_archivo_b: "Comprobante",
      columna_importe_archivo_a: "Importe",
      columna_importe_archivo_b: "Monto",
      detectar_duplicados: true,
      tolerancia_importe: 0,
    };
    const response = await handleSaveConciliationMappingRequest(
      mappingRequest(payload),
      "31",
      dependencies,
    );
    expect(response.status).toBe(200);
    const saveCall = vi.mocked(dependencies.fetchBackend).mock.calls[2];
    expect(saveCall[0]).toBe("/conciliaciones/31/mapping");
    expect(JSON.parse(String(saveCall[2]?.body))).toEqual(payload);

    const invalidDependencies = createDependencies([]);
    const invalid = await handleSaveConciliationMappingRequest(
      mappingRequest({ archivo_a_id: 8 }),
      "31",
      invalidDependencies,
    );
    expect(invalid.status).toBe(422);
    expect(invalidDependencies.fetchBackend).not.toHaveBeenCalled();
  });
});
