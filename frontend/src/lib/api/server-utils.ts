export type BackendRequestErrorKind =
  | "configuration"
  | "timeout"
  | "connection-refused"
  | "network";

export class BackendRequestError extends Error {
  readonly kind: BackendRequestErrorKind;

  constructor(kind: BackendRequestErrorKind, message: string) {
    super(message);
    this.name = "BackendRequestError";
    this.kind = kind;
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const SENSITIVE_REQUEST_HEADERS = [
  "authorization",
  "cookie",
  "proxy-authorization",
];

export interface BackendFetchOptions
  extends Omit<RequestInit, "signal"> {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function getBackendBaseUrl(rawUrl: string | undefined): URL {
  if (!rawUrl?.trim()) {
    throw new BackendRequestError(
      "configuration",
      "Falta la configuración del backend.",
    );
  }

  let backendUrl: URL;

  try {
    backendUrl = new URL(rawUrl.trim());
  } catch {
    throw new BackendRequestError(
      "configuration",
      "La configuración del backend no es una URL válida.",
    );
  }

  if (
    !["http:", "https:"].includes(backendUrl.protocol) ||
    backendUrl.username.length > 0 ||
    backendUrl.password.length > 0 ||
    backendUrl.search.length > 0 ||
    backendUrl.hash.length > 0 ||
    backendUrl.pathname !== "/"
  ) {
    throw new BackendRequestError(
      "configuration",
      "La configuración del backend no está permitida.",
    );
  }

  return backendUrl;
}

function assertBackendPath(backendPath: string): void {
  if (
    !backendPath.startsWith("/") ||
    backendPath.startsWith("//") ||
    backendPath.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(backendPath)
  ) {
    throw new BackendRequestError(
      "configuration",
      "La ruta solicitada al backend no es válida.",
    );
  }

  const pathname = backendPath.split(/[?#]/, 1)[0];

  try {
    const hasTraversalSegment = pathname
      .split("/")
      .some((segment) => [".", ".."].includes(decodeURIComponent(segment)));

    if (hasTraversalSegment) {
      throw new Error("Traversal segment");
    }
  } catch {
    throw new BackendRequestError(
      "configuration",
      "La ruta solicitada al backend no es válida.",
    );
  }
}

export function createBackendRequestUrl(
  rawBackendUrl: string | undefined,
  backendPath: string,
): URL {
  const backendUrl = getBackendBaseUrl(rawBackendUrl);
  assertBackendPath(backendPath);

  const requestUrl = new URL(backendPath, backendUrl);

  if (requestUrl.origin !== backendUrl.origin) {
    throw new BackendRequestError(
      "configuration",
      "La ruta solicitada no pertenece al backend configurado.",
    );
  }

  return requestUrl;
}

function isSafeContentDisposition(value: string): boolean {
  return (
    value.length <= 1_024 &&
    !/[\r\n]/.test(value) &&
    /^(?:attachment|inline)(?:;|$)/i.test(value.trim())
  );
}

interface ForwardResponseOptions {
  cacheControl?: string;
}

export function forwardBackendResponse(
  backendResponse: Response,
  options: ForwardResponseOptions = {},
): Response {
  const headers = new Headers();
  const contentType = backendResponse.headers.get("content-type");
  const contentDisposition = backendResponse.headers.get("content-disposition");
  const cacheControl =
    options.cacheControl ?? backendResponse.headers.get("cache-control");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (contentDisposition && isSafeContentDisposition(contentDisposition)) {
    headers.set("Content-Disposition", contentDisposition);
  }

  if (cacheControl) {
    headers.set("Cache-Control", cacheControl);
  }

  return new Response(backendResponse.body, {
    headers,
    status: backendResponse.status,
  });
}

export function getNetworkErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if ("cause" in error) {
    return getNetworkErrorCode(error.cause);
  }

  return undefined;
}

export async function executeBackendRequest(
  rawBackendUrl: string | undefined,
  backendPath: string,
  options: BackendFetchOptions = {},
  fetchImplementation: FetchImplementation = fetch,
): Promise<Response> {
  const { signal: callerSignal, timeoutMs = DEFAULT_TIMEOUT_MS, ...init } =
    options;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new BackendRequestError(
      "configuration",
      "El tiempo de espera configurado no es válido.",
    );
  }

  const requestUrl = createBackendRequestUrl(rawBackendUrl, backendPath);
  const headers = new Headers(init.headers);

  for (const header of SENSITIVE_REQUEST_HEADERS) {
    headers.delete(header);
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetchImplementation(requestUrl, {
      ...init,
      cache: "no-store",
      headers,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new BackendRequestError(
        "timeout",
        "La solicitud al backend superó el tiempo de espera.",
      );
    }

    if (getNetworkErrorCode(error) === "ECONNREFUSED") {
      throw new BackendRequestError(
        "connection-refused",
        "El backend rechazó la conexión.",
      );
    }

    throw new BackendRequestError(
      "network",
      "No se pudo establecer la conexión con el backend.",
    );
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}
