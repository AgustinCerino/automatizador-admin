import { ApiError, createApiError } from "@/lib/api/errors";
import type {
  ApiFetchOptions,
  ApiRequestBody,
  ApiResponseType,
} from "@/lib/api/types";

const INTERNAL_ORIGIN = "http://internal.invalid";

export function assertInternalApiPath(path: string): void {
  if (
    !path.startsWith("/api/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    throw new TypeError("La ruta debe apuntar a un endpoint interno /api/.");
  }

  let parsedPath: URL;

  try {
    parsedPath = new URL(path, INTERNAL_ORIGIN);
  } catch {
    throw new TypeError("La ruta interna no es válida.");
  }

  if (
    parsedPath.origin !== INTERNAL_ORIGIN ||
    !parsedPath.pathname.startsWith("/api/")
  ) {
    throw new TypeError("La ruta debe permanecer dentro de /api/.");
  }
}

function isNativeBody(body: ApiRequestBody): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
  );
}

function prepareBody(
  body: ApiRequestBody | undefined,
  headers: Headers,
): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (isNativeBody(body)) {
    return body;
  }

  if (!headers.has("content-type")) {
    headers.set("Content-Type", "application/json");
  }

  return JSON.stringify(body);
}

function getDefaultAcceptHeader(responseType: ApiResponseType): string {
  switch (responseType) {
    case "json":
      return "application/json";
    case "text":
      return "text/plain, */*";
    default:
      return "*/*";
  }
}

function isEmptyResponse(response: Response): boolean {
  return (
    response.status === 204 ||
    response.status === 205 ||
    response.headers.get("content-length") === "0"
  );
}

export async function apiFetch<TResponse>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<TResponse> {
  assertInternalApiPath(path);

  const {
    body,
    headers: providedHeaders,
    responseType = "json",
    ...requestInit
  } = options;
  const headers = new Headers(providedHeaders);

  if (!headers.has("accept")) {
    headers.set("Accept", getDefaultAcceptHeader(responseType));
  }

  const response = await fetch(path, {
    ...requestInit,
    body: prepareBody(body, headers),
    credentials: "same-origin",
    headers,
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  if (responseType === "void" || isEmptyResponse(response)) {
    return undefined as TResponse;
  }

  if (responseType === "text") {
    return (await response.text()) as TResponse;
  }

  if (responseType === "blob") {
    return (await response.blob()) as TResponse;
  }

  const responseText = await response.text();

  if (responseText.trim().length === 0) {
    return undefined as TResponse;
  }

  try {
    return JSON.parse(responseText) as TResponse;
  } catch {
    throw new ApiError(response.status, {
      code: "INVALID_RESPONSE",
      message: "La respuesta del servidor no es válida.",
    });
  }
}
