import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/features/auth/types";
import {
  handleInspectTransformationSourceFileRequest,
  handleListTransformationSourceFilesRequest,
  handleUploadTransformationSourceFileRequest,
} from "@/lib/api/authenticated-route-handlers";

type Dependencies = Parameters<typeof handleListTransformationSourceFilesRequest>[1];

const TOKEN = "header.payload.signature";
const USER = {
  cliente_id: 7,
  email: "admin@example.com",
  estado: "ACTIVO",
  id: 12,
  nombre: "Administración",
  rol: "ADMIN",
} satisfies CurrentUser;
const SUMMARY = { ejecucion_id: 31 };
const SOURCE_FILE = {
  checksum: "secret-checksum",
  ejecucion_id: 31,
  extension: ".xlsx",
  id: 8,
  mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  nombre_original: "origen.xlsx",
  ruta_storage: "/private/storage/origen.xlsx",
  size_bytes: 1024,
  tipo_archivo: "FUENTE",
  uploaded_at: "2026-08-07T12:00:00Z",
};
const STRUCTURE = {
  archivo_id: 8,
  available_sheets: [" Ventas 2026 "],
  columns: [{ detected_type: "integer", name: "Cantidad", null_count: 0 }],
  extension: ".xlsx",
  header_row: 2,
  nombre_original: "origen.xlsx",
  preview_limit: 20,
  rows: [{ Cantidad: 4 }],
  selected_sheet_name: " Ventas 2026 ",
  total_rows: 1,
  warnings: [],
};

function createDependencies(
  responses: Response[],
  overrides: Partial<Dependencies> = {},
): Dependencies {
  return {
    clearSessionToken: vi.fn<Dependencies["clearSessionToken"]>().mockResolvedValue(undefined),
    fetchBackend: vi.fn<Dependencies["fetchBackend"]>()
      .mockImplementation(async () => responses.shift() ?? Response.json({})),
    requireSession: vi.fn<Dependencies["requireSession"]>().mockResolvedValue({
      token: TOKEN,
      user: USER,
    }),
    ...overrides,
  };
}

function uploadRequest(formData: FormData, origin?: string): Request {
  return {
    formData: vi.fn().mockResolvedValue(formData),
    headers: new Headers(origin ? { Origin: origin } : undefined),
    url: "http://localhost/api/upload",
  } as unknown as Request;
}

describe("BFF de archivos fuente de transformación", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("valida la transformación, filtra fuentes compatibles y elimina datos sensibles", async () => {
    const dependencies = createDependencies([
      Response.json(SUMMARY),
      Response.json([
        SOURCE_FILE,
        { ...SOURCE_FILE, id: 9, extension: ".pdf", nombre_original: "factura.pdf" },
        { ...SOURCE_FILE, id: 10, tipo_archivo: "RESULTADO" },
      ]),
    ]);

    const response = await handleListTransformationSourceFilesRequest("31", dependencies);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toHaveLength(1);
    expect(payload[0]).not.toHaveProperty("ruta_storage");
    expect(payload[0]).not.toHaveProperty("checksum");
    expect(dependencies.fetchBackend).toHaveBeenNthCalledWith(
      1,
      "/transformaciones-excel/31/resumen",
      TOKEN,
      { headers: { Accept: "application/json" }, method: "GET" },
    );
    expect(dependencies.fetchBackend).toHaveBeenNthCalledWith(
      2,
      "/archivos/ejecucion/31",
      TOKEN,
      { headers: { Accept: "application/json" }, method: "GET" },
    );
  });

  it("rechaza upload cross-origin antes de autenticar", async () => {
    const body = new FormData();
    body.append("file", new File(["a,b"], "origen.csv"));
    const dependencies = createDependencies([]);
    const response = await handleUploadTransformationSourceFileRequest(
      uploadRequest(body, "https://attacker.example"),
      "31",
      dependencies,
    );

    expect(response.status).toBe(403);
    expect(dependencies.requireSession).not.toHaveBeenCalled();
  });

  it("acepta exactamente un archivo y agrega sólo los campos confiables", async () => {
    const body = new FormData();
    body.append("file", new File(["a,b\n1,2"], "origen.xlsx"));
    const dependencies = createDependencies([
      Response.json(SUMMARY),
      Response.json(SOURCE_FILE, { status: 201 }),
    ]);

    const response = await handleUploadTransformationSourceFileRequest(
      uploadRequest(body, "http://localhost"),
      "31",
      dependencies,
    );

    expect(response.status).toBe(201);
    const uploadCall = vi.mocked(dependencies.fetchBackend).mock.calls[1];
    expect(uploadCall[0]).toBe("/archivos/upload");
    const options = uploadCall[2];
    expect(options?.headers).toEqual({ Accept: "application/json" });
    expect(options?.body).toBeInstanceOf(FormData);
    const forwarded = options?.body as FormData;
    expect(forwarded.get("ejecucion_id")).toBe("31");
    expect(forwarded.get("tipo_archivo")).toBe("FUENTE");
    expect((forwarded.get("file") as File).name).toBe("origen.xlsx");
    const payload = await response.json();
    expect(payload).not.toHaveProperty("ruta_storage");
    expect(payload).not.toHaveProperty("checksum");
  });

  it("rechaza campos extra, múltiples archivos y extensiones no admitidas", async () => {
    for (const formData of [
      (() => { const data = new FormData(); data.append("file", new File(["x"], "a.csv")); data.append("ejecucion_id", "99"); return data; })(),
      (() => { const data = new FormData(); data.append("file", new File(["x"], "a.csv")); data.append("file", new File(["x"], "b.csv")); return data; })(),
      (() => { const data = new FormData(); data.append("file", new File(["x"], "a.pdf")); return data; })(),
    ]) {
      const dependencies = createDependencies([]);
      const response = await handleUploadTransformationSourceFileRequest(
        uploadRequest(formData),
        "31",
        dependencies,
      );
      expect(response.status).toBe(422);
      expect(dependencies.fetchBackend).not.toHaveBeenCalled();
    }
  });

  it("mantiene 413 como error controlado sin filtrar el detalle upstream", async () => {
    const body = new FormData();
    body.append("file", new File(["x"], "a.csv"));
    const dependencies = createDependencies([
      Response.json(SUMMARY),
      Response.json({ detail: "/private/storage" }, { status: 413 }),
    ]);
    const response = await handleUploadTransformationSourceFileRequest(
      uploadRequest(body),
      "31",
      dependencies,
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      code: "SOURCE_FILE_TOO_LARGE",
      message: "El archivo fuente supera el tamaño permitido.",
    });
  });

  it("verifica pertenencia y traduce la inspección con hoja exacta y límite fijo", async () => {
    const dependencies = createDependencies([
      Response.json(SUMMARY),
      Response.json([SOURCE_FILE]),
      Response.json(STRUCTURE),
    ]);
    const request = new Request(
      "http://localhost/api/structure?sheet=%20Ventas%202026%20&headerRow=2",
    );
    const response = await handleInspectTransformationSourceFileRequest(
      request,
      "31",
      "8",
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(dependencies.fetchBackend).toHaveBeenNthCalledWith(
      3,
      "/transformaciones-excel/archivos/8/estructura?header_row=2&limit=20&sheet_name=+Ventas+2026+",
      TOKEN,
      { headers: { Accept: "application/json" }, method: "GET" },
    );
  });

  it("no inspecciona un archivo ajeno a la ejecución", async () => {
    const dependencies = createDependencies([
      Response.json(SUMMARY),
      Response.json([SOURCE_FILE]),
    ]);
    const response = await handleInspectTransformationSourceFileRequest(
      new Request("http://localhost/api/structure?headerRow=1"),
      "31",
      "99",
      dependencies,
    );
    expect(response.status).toBe(404);
    expect(dependencies.fetchBackend).toHaveBeenCalledTimes(2);
  });

  it("rechaza hoja para CSV y parámetros browser no autorizados", async () => {
    const csvFile = { ...SOURCE_FILE, extension: ".csv", nombre_original: "origen.csv" };
    const dependencies = createDependencies([
      Response.json(SUMMARY),
      Response.json([csvFile]),
    ]);
    const response = await handleInspectTransformationSourceFileRequest(
      new Request("http://localhost/api/structure?sheet=Datos&headerRow=1"),
      "31",
      "8",
      dependencies,
    );
    expect(response.status).toBe(422);

    const invalid = await handleInspectTransformationSourceFileRequest(
      new Request("http://localhost/api/structure?headerRow=1&limit=100"),
      "31",
      "8",
      createDependencies([]),
    );
    expect(invalid.status).toBe(400);
  });
});
