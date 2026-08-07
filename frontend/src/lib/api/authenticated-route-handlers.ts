import type { ProcessRead } from "@/features/processes/types";
import {
  parseExecutionList,
  parseExecutionRead,
  parseProcessList,
  parseProcessRead,
} from "@/lib/api/backend-contracts";
import {
  BackendRequestError,
  type BackendFetchOptions,
} from "@/lib/api/server-utils";
import { isSameOriginRequest } from "@/lib/auth/origin";
import {
  RequiredSessionError,
  type AuthenticatedSession,
} from "@/lib/auth/session-contract";

interface AuthenticatedRouteDependencies {
  clearSessionToken: () => Promise<void>;
  fetchBackend: (
    backendPath: string,
    token: string,
    options?: BackendFetchOptions,
  ) => Promise<Response>;
  requireSession: () => Promise<AuthenticatedSession>;
}

interface SuccessResult<T> {
  ok: true;
  value: T;
}

interface ErrorResult {
  ok: false;
  response: Response;
}

type HandlerResult<T> = SuccessResult<T> | ErrorResult;

const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

const ERROR_PAYLOADS = {
  invalidOrigin: {
    code: "INVALID_ORIGIN",
    message: "La solicitud no está permitida.",
  },
  invalidRequest: {
    code: "INVALID_REQUEST",
    message: "La solicitud no es válida.",
  },
  sessionRequired: {
    code: "UNAUTHENTICATED",
    message: "Necesitás iniciar sesión para continuar.",
  },
  sessionExpired: {
    code: "SESSION_EXPIRED",
    message: "Tu sesión no es válida o ha vencido.",
  },
  forbidden: {
    code: "FORBIDDEN",
    message: "No tenés permisos para acceder a este recurso.",
  },
  notFound: {
    code: "NOT_FOUND",
    message: "El recurso solicitado no existe.",
  },
  conflict: {
    code: "CONFLICT",
    message: "La operación no puede realizarse en el estado actual.",
  },
  validation: {
    code: "VALIDATION_ERROR",
    message: "Los datos enviados no son válidos.",
  },
  unavailable: {
    code: "BACKEND_UNAVAILABLE",
    message: "El servidor no está disponible.",
  },
  internal: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Ocurrió un error interno.",
  },
} as const;

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    headers: PRIVATE_NO_STORE_HEADERS,
    status,
  });
}

function errorResponse(
  payload: (typeof ERROR_PAYLOADS)[keyof typeof ERROR_PAYLOADS],
  status: number,
): Response {
  return jsonResponse(payload, status);
}

export function parsePositiveInteger(value: string): number | undefined {
  if (!/^[1-9]\d*$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

async function resolveSession(
  dependencies: AuthenticatedRouteDependencies,
): Promise<HandlerResult<AuthenticatedSession>> {
  try {
    return { ok: true, value: await dependencies.requireSession() };
  } catch (error) {
    if (!(error instanceof RequiredSessionError)) {
      return {
        ok: false,
        response: errorResponse(ERROR_PAYLOADS.internal, 500),
      };
    }

    if (error.kind === "session-expired") {
      try {
        await dependencies.clearSessionToken();
      } catch {
        return {
          ok: false,
          response: errorResponse(ERROR_PAYLOADS.internal, 500),
        };
      }

      return {
        ok: false,
        response: errorResponse(ERROR_PAYLOADS.sessionExpired, 401),
      };
    }

    const responseByKind = {
      forbidden: errorResponse(ERROR_PAYLOADS.forbidden, 403),
      technical: errorResponse(ERROR_PAYLOADS.internal, 500),
      unauthenticated: errorResponse(ERROR_PAYLOADS.sessionRequired, 401),
      unavailable: errorResponse(ERROR_PAYLOADS.unavailable, 503),
    } as const;

    return { ok: false, response: responseByKind[error.kind] };
  }
}

async function normalizeBackendFailure(
  response: Response,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  if (response.status === 401) {
    try {
      await dependencies.clearSessionToken();
    } catch {
      return errorResponse(ERROR_PAYLOADS.internal, 500);
    }

    return errorResponse(ERROR_PAYLOADS.sessionExpired, 401);
  }

  switch (response.status) {
    case 403:
      return errorResponse(ERROR_PAYLOADS.forbidden, 403);
    case 404:
      return errorResponse(ERROR_PAYLOADS.notFound, 404);
    case 409:
      return errorResponse(ERROR_PAYLOADS.conflict, 409);
    case 422:
      return errorResponse(ERROR_PAYLOADS.validation, 422);
    case 502:
    case 503:
    case 504:
      return errorResponse(ERROR_PAYLOADS.unavailable, 503);
    default:
      return errorResponse(ERROR_PAYLOADS.internal, 500);
  }
}

async function callBackend(
  backendPath: string,
  session: AuthenticatedSession,
  dependencies: AuthenticatedRouteDependencies,
  options: BackendFetchOptions = {},
): Promise<HandlerResult<unknown>> {
  let response: Response;

  try {
    response = await dependencies.fetchBackend(
      backendPath,
      session.token,
      options,
    );
  } catch (error) {
    const unavailable =
      error instanceof BackendRequestError && error.kind !== "configuration";

    return {
      ok: false,
      response: errorResponse(
        unavailable ? ERROR_PAYLOADS.unavailable : ERROR_PAYLOADS.internal,
        unavailable ? 503 : 500,
      ),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      response: await normalizeBackendFailure(response, dependencies),
    };
  }

  try {
    return { ok: true, value: await response.json() };
  } catch {
    return {
      ok: false,
      response: errorResponse(ERROR_PAYLOADS.internal, 500),
    };
  }
}

async function getOwnedProcess(
  processId: number,
  session: AuthenticatedSession,
  dependencies: AuthenticatedRouteDependencies,
): Promise<HandlerResult<ProcessRead>> {
  const result = await callBackend(
    `/procesos/${processId}`,
    session,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
  );

  if (!result.ok) {
    return result;
  }

  const process = parseProcessRead(result.value);

  if (!process) {
    return {
      ok: false,
      response: errorResponse(ERROR_PAYLOADS.internal, 500),
    };
  }

  if (process.cliente_id !== session.user.cliente_id) {
    return {
      ok: false,
      response: errorResponse(ERROR_PAYLOADS.forbidden, 403),
    };
  }

  return { ok: true, value: process };
}

function invalidIdentifierResponse(): Response {
  return errorResponse(ERROR_PAYLOADS.invalidRequest, 400);
}

export async function handleListProcessesRequest(
  _request: Request,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const sessionResult = await resolveSession(dependencies);

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const { session } = { session: sessionResult.value };
  const result = await callBackend(
    `/procesos?cliente_id=${encodeURIComponent(session.user.cliente_id)}`,
    session,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
  );

  if (!result.ok) {
    return result.response;
  }

  const processes = parseProcessList(result.value);

  if (
    !processes ||
    processes.some(
      (process) => process.cliente_id !== session.user.cliente_id,
    )
  ) {
    return errorResponse(ERROR_PAYLOADS.internal, 500);
  }

  return jsonResponse(processes);
}

export async function handleGetProcessRequest(
  rawProcessId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const processId = parsePositiveInteger(rawProcessId);

  if (!processId) {
    return invalidIdentifierResponse();
  }

  const sessionResult = await resolveSession(dependencies);

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const processResult = await getOwnedProcess(
    processId,
    sessionResult.value,
    dependencies,
  );

  return processResult.ok
    ? jsonResponse(processResult.value)
    : processResult.response;
}

export async function handleListProcessExecutionsRequest(
  rawProcessId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const processId = parsePositiveInteger(rawProcessId);

  if (!processId) {
    return invalidIdentifierResponse();
  }

  const sessionResult = await resolveSession(dependencies);

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const processResult = await getOwnedProcess(
    processId,
    sessionResult.value,
    dependencies,
  );

  if (!processResult.ok) {
    return processResult.response;
  }

  const result = await callBackend(
    `/ejecuciones?proceso_id=${encodeURIComponent(processId)}`,
    sessionResult.value,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
  );

  if (!result.ok) {
    return result.response;
  }

  const executions = parseExecutionList(result.value);

  if (
    !executions ||
    executions.some((execution) => execution.proceso_id !== processId)
  ) {
    return errorResponse(ERROR_PAYLOADS.internal, 500);
  }

  return jsonResponse(executions);
}

function parseCreateExecutionBody(value: unknown): number | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== "proceso_id") ||
    !("proceso_id" in value) ||
    typeof value.proceso_id !== "number" ||
    !Number.isSafeInteger(value.proceso_id) ||
    value.proceso_id <= 0
  ) {
    return undefined;
  }

  return value.proceso_id;
}

export async function handleCreateExecutionRequest(
  request: Request,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return errorResponse(ERROR_PAYLOADS.invalidOrigin, 403);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(ERROR_PAYLOADS.invalidRequest, 400);
  }

  const processId = parseCreateExecutionBody(body);

  if (!processId) {
    return errorResponse(ERROR_PAYLOADS.validation, 422);
  }

  const sessionResult = await resolveSession(dependencies);

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const processResult = await getOwnedProcess(
    processId,
    sessionResult.value,
    dependencies,
  );

  if (!processResult.ok) {
    return processResult.response;
  }

  const result = await callBackend(
    "/ejecuciones",
    sessionResult.value,
    dependencies,
    {
      body: JSON.stringify({ proceso_id: processId }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!result.ok) {
    return result.response;
  }

  const execution = parseExecutionRead(result.value);

  if (!execution || execution.proceso_id !== processId) {
    return errorResponse(ERROR_PAYLOADS.internal, 500);
  }

  return jsonResponse(execution, 201);
}

export async function handleGetExecutionRequest(
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const executionId = parsePositiveInteger(rawExecutionId);

  if (!executionId) {
    return invalidIdentifierResponse();
  }

  const sessionResult = await resolveSession(dependencies);

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const result = await callBackend(
    `/ejecuciones/${executionId}`,
    sessionResult.value,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
  );

  if (!result.ok) {
    return result.response;
  }

  const execution = parseExecutionRead(result.value);

  if (!execution) {
    return errorResponse(ERROR_PAYLOADS.internal, 500);
  }

  const processResult = await getOwnedProcess(
    execution.proceso_id,
    sessionResult.value,
    dependencies,
  );

  return processResult.ok ? jsonResponse(execution) : processResult.response;
}
