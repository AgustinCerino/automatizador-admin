import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 10_000;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../openapi/openapi.json");
const temporaryPath = `${outputPath}.tmp`;

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (!isObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortObject(value[key])]),
  );
}

function validateOpenApiDocument(document) {
  if (
    !isObject(document) ||
    typeof document.openapi !== "string" ||
    !document.openapi.startsWith("3.") ||
    !isObject(document.info) ||
    !isObject(document.paths)
  ) {
    throw new Error("El backend no devolvió un documento OpenAPI 3.x válido.");
  }
}

async function exportOpenApi() {
  const backendUrl = (process.env.BACKEND_URL ?? DEFAULT_BACKEND_URL).replace(
    /\/+$/,
    "",
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${backendUrl}/openapi.json`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`El backend respondió con estado ${response.status}.`);
    }

    const document = await response.json();
    validateOpenApiDocument(document);

    const serializedDocument = `${JSON.stringify(sortObject(document), null, 2)}\n`;
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(temporaryPath, serializedDocument, "utf8");
    await rename(temporaryPath, outputPath);

    console.log(
      `OpenAPI exportado correctamente (${Object.keys(document.paths).length} rutas).`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

try {
  await exportOpenApi();
} catch (error) {
  await rm(temporaryPath, { force: true });

  const message =
    error instanceof Error && error.name === "AbortError"
      ? "La exportación de OpenAPI superó el tiempo de espera."
      : error instanceof Error
        ? error.message
        : "Ocurrió un error desconocido.";

  console.error(`No se pudo exportar OpenAPI: ${message}`);
  process.exitCode = 1;
}
