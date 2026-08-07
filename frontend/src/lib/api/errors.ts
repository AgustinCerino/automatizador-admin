import type { ApiErrorPayload } from "@/lib/api/types";

const GENERIC_ERROR_MESSAGE = "Ocurrió un error interno.";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSafeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (
    normalized.length === 0 ||
    normalized.length > 500 ||
    /<\/?[a-z][\s\S]*>/i.test(normalized) ||
    /(?:https?:\/\/|localhost|127\.0\.0\.1|[a-z]:\\)/i.test(normalized) ||
    /(?:^|\s)(?:(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+)?\/[a-z0-9._~!$&'()*+,;=:@%/-]+/i.test(
      normalized,
    ) ||
    /(?:traceback|\bat\s+\S+\s+\([^)]*:\d+:\d+\))/i.test(normalized)
  ) {
    return undefined;
  }

  return normalized;
}

function normalizeCode(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return /^[A-Z0-9_-]{1,100}$/i.test(normalized) ? normalized : undefined;
}

export function getFallbackErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return "La solicitud no es válida.";
    case 401:
      return "Tu sesión no es válida o ha vencido.";
    case 403:
      return "No tenés permisos para acceder a este recurso.";
    case 404:
      return "El recurso solicitado no existe.";
    case 409:
      return "La operación no puede realizarse en el estado actual.";
    case 413:
      return "El archivo o contenido supera el límite permitido.";
    case 422:
      return "Los datos enviados no son válidos.";
    case 503:
      return "El servidor no está disponible.";
    default:
      return status >= 500
        ? GENERIC_ERROR_MESSAGE
        : "No se pudo completar la solicitud.";
  }
}

export function normalizeApiErrorPayload(
  status: number,
  body: unknown,
): ApiErrorPayload {
  const fallbackMessage = getFallbackErrorMessage(status);

  if (typeof body === "string") {
    return {
      message: normalizeSafeString(body) ?? fallbackMessage,
    };
  }

  if (!isRecord(body)) {
    return { message: fallbackMessage };
  }

  const detail = body.detail;

  if (Array.isArray(detail)) {
    return {
      message: fallbackMessage,
      details: detail,
    };
  }

  const detailMessage = normalizeSafeString(detail);
  const message = normalizeSafeString(body.message) ?? detailMessage;
  const code = normalizeCode(body.code);
  const details = body.details;

  return {
    ...(code ? { code } : {}),
    message: message ?? fallbackMessage,
    ...(details !== undefined ? { details } : {}),
  };
}

export async function createApiError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let body: unknown;

  try {
    const responseText = await response.text();

    if (responseText.trim().length === 0) {
      body = undefined;
    } else if (contentType.includes("json")) {
      try {
        body = JSON.parse(responseText) as unknown;
      } catch {
        body = undefined;
      }
    } else if (contentType.includes("html")) {
      body = undefined;
    } else {
      body = responseText;
    }
  } catch {
    body = undefined;
  }

  return new ApiError(
    response.status,
    normalizeApiErrorPayload(response.status, body),
  );
}
