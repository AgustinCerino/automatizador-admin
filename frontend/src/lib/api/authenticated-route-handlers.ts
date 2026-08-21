import type { ProcessRead } from "@/features/processes/types";
import type {
  ConciliationFileSelection,
  ConciliationMappingCreate,
} from "@/features/conciliations/types";
import {
  parseConciliationFile,
  parseConciliationFileList,
  parseConciliationFilePreview,
  parseConciliationFileSelection,
  parseConciliationMapping,
  parseExecutionList,
  parseExecutionRead,
  parseProcessList,
  parseProcessRead,
  parseTransformationSourceFile,
  parseTransformationSourceFileList,
  parseTransformationSourceStructure,
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
type ErrorPayload = (typeof ERROR_PAYLOADS)[keyof typeof ERROR_PAYLOADS];
type BackendFailureOverrides = Partial<Record<number, ErrorPayload>>;

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
  incompatibleTransformation: {
    code: "INCOMPATIBLE_TRANSFORMATION",
    message: "Esta ejecución no corresponde a una transformación Excel.",
  },
  incompatibleConciliation: {
    code: "INCOMPATIBLE_CONCILIATION",
    message: "Esta ejecución no corresponde a una conciliación Excel.",
  },
  conciliationSelectionNotFound: {
    code: "CONCILIATION_SELECTION_NOT_FOUND",
    message: "Todavía no hay archivos A/B seleccionados.",
  },
  conciliationMappingNotFound: {
    code: "CONCILIATION_MAPPING_NOT_FOUND",
    message: "Todav\u00eda no hay un mapping de conciliaci\u00f3n guardado.",
  },
  invalidConciliationFile: {
    code: "INVALID_CONCILIATION_FILE",
    message: "El archivo no es compatible con Conciliación Excel.",
  },
  invalidConciliationSelection: {
    code: "INVALID_CONCILIATION_SELECTION",
    message: "La selección de archivos A/B no es válida.",
  },
  invalidConciliationMapping: {
    code: "INVALID_CONCILIATION_MAPPING",
    message: "La configuraci\u00f3n de conciliaci\u00f3n no es v\u00e1lida.",
  },
  invalidConciliationPreview: {
    code: "INVALID_CONCILIATION_PREVIEW",
    message: "No se pudo previsualizar el archivo seleccionado.",
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
  invalidSourceFile: {
    code: "INVALID_SOURCE_FILE",
    message: "El archivo fuente no es válido o no está permitido.",
  },
  sourceFileTooLarge: {
    code: "SOURCE_FILE_TOO_LARGE",
    message: "El archivo fuente supera el tamaño permitido.",
  },
  invalidInspection: {
    code: "INVALID_SOURCE_INSPECTION",
    message: "No se pudo inspeccionar el archivo con esos parámetros.",
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
  payload: ErrorPayload,
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
  overrides: BackendFailureOverrides = {},
): Promise<Response> {
  if (response.status === 401) {
    try {
      await dependencies.clearSessionToken();
    } catch {
      return errorResponse(ERROR_PAYLOADS.internal, 500);
    }

    return errorResponse(ERROR_PAYLOADS.sessionExpired, 401);
  }

  const overriddenPayload = overrides[response.status];
  if (overriddenPayload) {
    return errorResponse(overriddenPayload, response.status);
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
  failureOverrides: BackendFailureOverrides = {},
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
      response: await normalizeBackendFailure(
        response,
        dependencies,
        failureOverrides,
      ),
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

export async function handleGetTransformationSummaryRequest(
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
    `/transformaciones-excel/${executionId}/resumen`,
    sessionResult.value,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
    { 400: ERROR_PAYLOADS.incompatibleTransformation },
  );

  return result.ok ? jsonResponse(result.value) : result.response;
}

export async function handleGetTransformationConfigurationRequest(
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const result = await callBackend(
    `/transformaciones-excel/${executionId}/configuracion`,
    sessionResult.value,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
    { 400: ERROR_PAYLOADS.incompatibleTransformation },
  );
  return result.ok ? jsonResponse(result.value) : result.response;
}

export async function handleSaveTransformationConfigurationRequest(
  request: Request,
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return errorResponse(ERROR_PAYLOADS.invalidOrigin, 403);
  }

  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  let configuration: unknown;
  try {
    configuration = await request.json();
  } catch {
    return errorResponse(ERROR_PAYLOADS.invalidRequest, 400);
  }
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return errorResponse(ERROR_PAYLOADS.validation, 422);
  }

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const result = await callBackend(
    `/transformaciones-excel/${executionId}/configuracion`,
    sessionResult.value,
    dependencies,
    {
      body: JSON.stringify(configuration),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      method: "POST",
    },
    { 400: ERROR_PAYLOADS.incompatibleTransformation },
  );
  return result.ok ? jsonResponse(result.value) : result.response;
}

export async function handleValidateTransformationConfigurationRequest(
  request: Request,
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return errorResponse(ERROR_PAYLOADS.invalidOrigin, 403);
  }

  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const result = await callBackend(
    `/transformaciones-excel/${executionId}/validar?preview_limit=20`,
    sessionResult.value,
    dependencies,
    { headers: { Accept: "application/json" }, method: "POST" },
    { 400: ERROR_PAYLOADS.incompatibleTransformation },
  );
  return result.ok ? jsonResponse(result.value) : result.response;
}

export async function handleGenerateTransformationResultRequest(
  request: Request,
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  if (!isSameOriginRequest(request)) return errorResponse(ERROR_PAYLOADS.invalidOrigin, 403);

  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const result = await callBackend(
    `/transformaciones-excel/${executionId}/generar`,
    sessionResult.value,
    dependencies,
    { headers: { Accept: "application/json" }, method: "POST" },
    { 400: ERROR_PAYLOADS.incompatibleTransformation },
  );
  return result.ok ? jsonResponse(result.value) : result.response;
}

export async function handleGetTransformationResultRequest(
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const result = await callBackend(
    `/transformaciones-excel/${executionId}/resultado`,
    sessionResult.value,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
    { 400: ERROR_PAYLOADS.incompatibleTransformation },
  );
  return result.ok ? jsonResponse(result.value) : result.response;
}

export async function handleDownloadTransformationResultRequest(
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  let backendResponse: Response;
  try {
    backendResponse = await dependencies.fetchBackend(
      `/transformaciones-excel/${executionId}/resultado/descargar`,
      sessionResult.value.token,
      { headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, method: "GET" },
    );
  } catch (error) {
    const unavailable = error instanceof BackendRequestError && error.kind !== "configuration";
    return errorResponse(unavailable ? ERROR_PAYLOADS.unavailable : ERROR_PAYLOADS.internal, unavailable ? 503 : 500);
  }

  if (!backendResponse.ok) return normalizeBackendFailure(backendResponse, dependencies, { 400: ERROR_PAYLOADS.incompatibleTransformation });

  const headers = new Headers(PRIVATE_NO_STORE_HEADERS);
  for (const header of ["content-type", "content-disposition"]) {
    const value = backendResponse.headers.get(header);
    if (value) headers.set(header, value);
  }
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(backendResponse.body, { headers, status: backendResponse.status });
}

const TRANSFORMATION_SOURCE_FILE_TYPE = "FUENTE";
const TRANSFORMATION_SOURCE_EXTENSIONS = new Set([".csv", ".xls", ".xlsx"]);

function isSupportedTransformationSourceFile(
  file: ReturnType<typeof parseTransformationSourceFile>,
): file is NonNullable<ReturnType<typeof parseTransformationSourceFile>> {
  return (
    file !== undefined &&
    file.tipo_archivo === TRANSFORMATION_SOURCE_FILE_TYPE &&
    file.extension !== null &&
    TRANSFORMATION_SOURCE_EXTENSIONS.has(file.extension.toLowerCase())
  );
}

async function validateTransformationExecution(
  executionId: number,
  session: AuthenticatedSession,
  dependencies: AuthenticatedRouteDependencies,
): Promise<HandlerResult<unknown>> {
  return callBackend(
    `/transformaciones-excel/${executionId}/resumen`,
    session,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
    { 400: ERROR_PAYLOADS.incompatibleTransformation },
  );
}

async function getTransformationSourceFiles(
  executionId: number,
  session: AuthenticatedSession,
  dependencies: AuthenticatedRouteDependencies,
) {
  const contextResult = await validateTransformationExecution(
    executionId,
    session,
    dependencies,
  );
  if (!contextResult.ok) return contextResult;

  const filesResult = await callBackend(
    `/archivos/ejecucion/${executionId}`,
    session,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
  );
  if (!filesResult.ok) return filesResult;

  const files = parseTransformationSourceFileList(filesResult.value);
  if (!files || files.some((file) => file.ejecucion_id !== executionId)) {
    return {
      ok: false as const,
      response: errorResponse(ERROR_PAYLOADS.internal, 500),
    };
  }

  return {
    ok: true as const,
    value: files.filter(isSupportedTransformationSourceFile),
  };
}

export async function handleListTransformationSourceFilesRequest(
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const filesResult = await getTransformationSourceFiles(
    executionId,
    sessionResult.value,
    dependencies,
  );
  return filesResult.ok ? jsonResponse(filesResult.value) : filesResult.response;
}

function getFileExtension(filename: string): string | undefined {
  const extensionStart = filename.lastIndexOf(".");
  return extensionStart > 0 ? filename.slice(extensionStart).toLowerCase() : undefined;
}

function parseSingleUploadFile(formData: FormData): File | undefined {
  const entries = [...formData.entries()];
  if (entries.length !== 1 || entries[0][0] !== "file") return undefined;

  const value = entries[0][1];
  if (!(value instanceof File) || value.name.length === 0) return undefined;
  return value;
}

export async function handleUploadTransformationSourceFileRequest(
  request: Request,
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return errorResponse(ERROR_PAYLOADS.invalidOrigin, 403);
  }

  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  let incomingFormData: FormData;
  try {
    incomingFormData = await request.formData();
  } catch {
    return errorResponse(ERROR_PAYLOADS.invalidRequest, 400);
  }

  const file = parseSingleUploadFile(incomingFormData);
  const extension = file ? getFileExtension(file.name) : undefined;
  if (!file || !extension || !TRANSFORMATION_SOURCE_EXTENSIONS.has(extension)) {
    return errorResponse(ERROR_PAYLOADS.invalidSourceFile, 422);
  }

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const contextResult = await validateTransformationExecution(
    executionId,
    sessionResult.value,
    dependencies,
  );
  if (!contextResult.ok) return contextResult.response;

  const backendFormData = new FormData();
  backendFormData.append("ejecucion_id", String(executionId));
  backendFormData.append("tipo_archivo", TRANSFORMATION_SOURCE_FILE_TYPE);
  backendFormData.append("file", file, file.name);

  const uploadResult = await callBackend(
    "/archivos/upload",
    sessionResult.value,
    dependencies,
    { body: backendFormData, headers: { Accept: "application/json" }, method: "POST" },
    {
      400: ERROR_PAYLOADS.invalidSourceFile,
      413: ERROR_PAYLOADS.sourceFileTooLarge,
    },
  );
  if (!uploadResult.ok) return uploadResult.response;

  const uploadedFile = parseTransformationSourceFile(uploadResult.value);
  if (
    !isSupportedTransformationSourceFile(uploadedFile) ||
    uploadedFile.ejecucion_id !== executionId
  ) {
    return errorResponse(ERROR_PAYLOADS.internal, 500);
  }

  return jsonResponse(uploadedFile, 201);
}

interface InspectionParameters {
  headerRow: number;
  sheet: string | null;
}

function parseInspectionParameters(request: Request): InspectionParameters | undefined {
  let searchParams: URLSearchParams;
  try {
    searchParams = new URL(request.url).searchParams;
  } catch {
    return undefined;
  }

  if (
    [...searchParams.keys()].some((key) => key !== "sheet" && key !== "headerRow") ||
    searchParams.getAll("sheet").length > 1 ||
    searchParams.getAll("headerRow").length > 1
  ) {
    return undefined;
  }

  const rawHeaderRow = searchParams.get("headerRow") ?? "1";
  const headerRow = parsePositiveInteger(rawHeaderRow);
  if (!headerRow) return undefined;

  return { headerRow, sheet: searchParams.get("sheet") };
}

export async function handleInspectTransformationSourceFileRequest(
  request: Request,
  rawExecutionId: string,
  rawFileId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const executionId = parsePositiveInteger(rawExecutionId);
  const fileId = parsePositiveInteger(rawFileId);
  const inspection = parseInspectionParameters(request);
  if (!executionId || !fileId || !inspection) return invalidIdentifierResponse();

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const contextResult = await validateTransformationExecution(
    executionId,
    sessionResult.value,
    dependencies,
  );
  if (!contextResult.ok) return contextResult.response;

  const backendQuery = new URLSearchParams({
    header_row: String(inspection.headerRow),
    limit: "20",
  });
  if (inspection.sheet !== null) {
    backendQuery.set("sheet_name", inspection.sheet);
  }

  const structureResult = await callBackend(
    `/transformaciones-excel/archivos/${fileId}/estructura?${backendQuery.toString()}`,
    sessionResult.value,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
    { 400: ERROR_PAYLOADS.invalidInspection },
  );
  if (!structureResult.ok) return structureResult.response;

  const structure = parseTransformationSourceStructure(structureResult.value);
  if (!structure || structure.archivo_id !== fileId) {
    return errorResponse(ERROR_PAYLOADS.internal, 500);
  }

  return jsonResponse(structure);
}

const CONCILIATION_INPUT_FILE_TYPE = "ENTRADA_CONCILIACION";
const CONCILIATION_FILE_EXTENSIONS = new Set([".csv", ".xls", ".xlsx"]);

async function validateConciliationExecution(
  executionId: number,
  session: AuthenticatedSession,
  dependencies: AuthenticatedRouteDependencies,
): Promise<HandlerResult<unknown>> {
  const executionResult = await callBackend(
    `/ejecuciones/${executionId}`,
    session,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
  );
  if (!executionResult.ok) return executionResult;

  const execution = parseExecutionRead(executionResult.value);
  if (!execution) {
    return {
      ok: false,
      response: errorResponse(ERROR_PAYLOADS.internal, 500),
    };
  }

  const processResult = await getOwnedProcess(
    execution.proceso_id,
    session,
    dependencies,
  );
  if (!processResult.ok) return processResult;
  if (processResult.value.tipo !== "CONCILIACION_EXCEL") {
    return {
      ok: false,
      response: errorResponse(ERROR_PAYLOADS.incompatibleConciliation, 400),
    };
  }

  return { ok: true, value: execution };
}

function isSupportedConciliationFile(
  file: ReturnType<typeof parseConciliationFile>,
): file is NonNullable<ReturnType<typeof parseConciliationFile>> {
  return (
    file !== undefined &&
    file.extension !== null &&
    CONCILIATION_FILE_EXTENSIONS.has(file.extension.toLowerCase())
  );
}

async function getConciliationFiles(
  executionId: number,
  session: AuthenticatedSession,
  dependencies: AuthenticatedRouteDependencies,
) {
  const contextResult = await validateConciliationExecution(
    executionId,
    session,
    dependencies,
  );
  if (!contextResult.ok) return contextResult;

  const filesResult = await callBackend(
    `/archivos/ejecucion/${executionId}`,
    session,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
  );
  if (!filesResult.ok) return filesResult;

  const files = parseConciliationFileList(filesResult.value);
  if (!files || files.some((file) => file.ejecucion_id !== executionId)) {
    return {
      ok: false as const,
      response: errorResponse(ERROR_PAYLOADS.internal, 500),
    };
  }

  return {
    ok: true as const,
    value: files.filter(isSupportedConciliationFile),
  };
}

export async function handleListConciliationFilesRequest(
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const filesResult = await getConciliationFiles(
    executionId,
    sessionResult.value,
    dependencies,
  );
  return filesResult.ok ? jsonResponse(filesResult.value) : filesResult.response;
}

export async function handleUploadConciliationFileRequest(
  request: Request,
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return errorResponse(ERROR_PAYLOADS.invalidOrigin, 403);
  }

  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  let incomingFormData: FormData;
  try {
    incomingFormData = await request.formData();
  } catch {
    return errorResponse(ERROR_PAYLOADS.invalidRequest, 400);
  }

  const file = parseSingleUploadFile(incomingFormData);
  const extension = file ? getFileExtension(file.name) : undefined;
  if (!file || !extension || !CONCILIATION_FILE_EXTENSIONS.has(extension)) {
    return errorResponse(ERROR_PAYLOADS.invalidConciliationFile, 422);
  }

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const contextResult = await validateConciliationExecution(
    executionId,
    sessionResult.value,
    dependencies,
  );
  if (!contextResult.ok) return contextResult.response;

  const backendFormData = new FormData();
  backendFormData.append("ejecucion_id", String(executionId));
  backendFormData.append("tipo_archivo", CONCILIATION_INPUT_FILE_TYPE);
  backendFormData.append("file", file, file.name);

  const uploadResult = await callBackend(
    "/archivos/upload",
    sessionResult.value,
    dependencies,
    { body: backendFormData, headers: { Accept: "application/json" }, method: "POST" },
    {
      400: ERROR_PAYLOADS.invalidConciliationFile,
      413: ERROR_PAYLOADS.sourceFileTooLarge,
    },
  );
  if (!uploadResult.ok) return uploadResult.response;

  const uploadedFile = parseConciliationFile(uploadResult.value);
  if (
    !isSupportedConciliationFile(uploadedFile) ||
    uploadedFile.ejecucion_id !== executionId
  ) {
    return errorResponse(ERROR_PAYLOADS.internal, 500);
  }

  return jsonResponse(uploadedFile, 201);
}

export async function handleGetConciliationSelectionRequest(
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const contextResult = await validateConciliationExecution(
    executionId,
    sessionResult.value,
    dependencies,
  );
  if (!contextResult.ok) return contextResult.response;

  const selectionResult = await callBackend(
    `/conciliaciones/${executionId}/archivos`,
    sessionResult.value,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
    { 404: ERROR_PAYLOADS.conciliationSelectionNotFound },
  );
  if (!selectionResult.ok) return selectionResult.response;

  const selection = parseConciliationFileSelection(selectionResult.value);
  return selection
    ? jsonResponse(selection)
    : errorResponse(ERROR_PAYLOADS.internal, 500);
}

function parseSelectionRequestBody(
  value: unknown,
): ConciliationFileSelection | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => key !== "archivo_a_id" && key !== "archivo_b_id",
    )
  ) {
    return undefined;
  }
  return parseConciliationFileSelection(value);
}

export async function handleSaveConciliationSelectionRequest(
  request: Request,
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return errorResponse(ERROR_PAYLOADS.invalidOrigin, 403);
  }

  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(ERROR_PAYLOADS.invalidRequest, 400);
  }
  const selection = parseSelectionRequestBody(body);
  if (!selection) {
    return errorResponse(ERROR_PAYLOADS.invalidConciliationSelection, 422);
  }

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const contextResult = await validateConciliationExecution(
    executionId,
    sessionResult.value,
    dependencies,
  );
  if (!contextResult.ok) return contextResult.response;

  const selectionResult = await callBackend(
    `/conciliaciones/${executionId}/archivos`,
    sessionResult.value,
    dependencies,
    {
      body: JSON.stringify(selection),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      method: "PUT",
    },
    { 400: ERROR_PAYLOADS.invalidConciliationSelection },
  );
  if (!selectionResult.ok) return selectionResult.response;

  const savedSelection = parseConciliationFileSelection(selectionResult.value);
  return savedSelection
    ? jsonResponse(savedSelection)
    : errorResponse(ERROR_PAYLOADS.internal, 500);
}

function parseMappingRequestBody(
  value: unknown,
): ConciliationMappingCreate | undefined {
  if (
    typeof value !== "object" || value === null || Array.isArray(value) ||
    Object.keys(value).some((key) => ![
      "archivo_a_id", "archivo_b_id", "columna_clave_archivo_a",
      "columna_clave_archivo_b", "columna_importe_archivo_a",
      "columna_importe_archivo_b", "tolerancia_importe", "detectar_duplicados",
    ].includes(key))
  ) return undefined;

  const mapping = value as Record<string, unknown>;
  const columns = [mapping.columna_clave_archivo_a, mapping.columna_clave_archivo_b, mapping.columna_importe_archivo_a, mapping.columna_importe_archivo_b];
  if (
    !parseConciliationFileSelection({ archivo_a_id: mapping.archivo_a_id, archivo_b_id: mapping.archivo_b_id }) ||
    !columns.every((column) => typeof column === "string" && column.trim().length > 0) ||
    typeof mapping.tolerancia_importe !== "number" || !Number.isFinite(mapping.tolerancia_importe) ||
    typeof mapping.detectar_duplicados !== "boolean"
  ) return undefined;

  return mapping as ConciliationMappingCreate;
}

export async function handleGetConciliationMappingRequest(
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();
  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;
  const contextResult = await validateConciliationExecution(executionId, sessionResult.value, dependencies);
  if (!contextResult.ok) return contextResult.response;
  const result = await callBackend(
    `/conciliaciones/${executionId}/mapping`, sessionResult.value, dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
    { 404: ERROR_PAYLOADS.conciliationMappingNotFound },
  );
  if (!result.ok) return result.response;
  const mapping = parseConciliationMapping(result.value);
  return mapping ? jsonResponse(mapping) : errorResponse(ERROR_PAYLOADS.internal, 500);
}

export async function handleSaveConciliationMappingRequest(
  request: Request,
  rawExecutionId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  if (!isSameOriginRequest(request)) return errorResponse(ERROR_PAYLOADS.invalidOrigin, 403);
  const executionId = parsePositiveInteger(rawExecutionId);
  if (!executionId) return invalidIdentifierResponse();
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse(ERROR_PAYLOADS.invalidRequest, 400); }
  const mapping = parseMappingRequestBody(body);
  if (!mapping) return errorResponse(ERROR_PAYLOADS.invalidConciliationMapping, 422);
  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;
  const contextResult = await validateConciliationExecution(executionId, sessionResult.value, dependencies);
  if (!contextResult.ok) return contextResult.response;
  const result = await callBackend(
    `/conciliaciones/${executionId}/mapping`, sessionResult.value, dependencies,
    { body: JSON.stringify(mapping), headers: { Accept: "application/json", "Content-Type": "application/json" }, method: "POST" },
    { 400: ERROR_PAYLOADS.invalidConciliationMapping },
  );
  if (!result.ok) return result.response;
  const savedMapping = parseConciliationMapping(result.value);
  return savedMapping ? jsonResponse(savedMapping) : errorResponse(ERROR_PAYLOADS.internal, 500);
}

export async function handleGetConciliationPreviewRequest(
  rawExecutionId: string,
  rawFileId: string,
  dependencies: AuthenticatedRouteDependencies,
): Promise<Response> {
  const executionId = parsePositiveInteger(rawExecutionId);
  const fileId = parsePositiveInteger(rawFileId);
  if (!executionId || !fileId) return invalidIdentifierResponse();

  const sessionResult = await resolveSession(dependencies);
  if (!sessionResult.ok) return sessionResult.response;

  const filesResult = await getConciliationFiles(
    executionId,
    sessionResult.value,
    dependencies,
  );
  if (!filesResult.ok) return filesResult.response;
  if (!filesResult.value.some((file) => file.id === fileId)) {
    return errorResponse(ERROR_PAYLOADS.notFound, 404);
  }

  const previewResult = await callBackend(
    `/archivos/${fileId}/preview?limit=20`,
    sessionResult.value,
    dependencies,
    { headers: { Accept: "application/json" }, method: "GET" },
    { 400: ERROR_PAYLOADS.invalidConciliationPreview },
  );
  if (!previewResult.ok) return previewResult.response;

  const preview = parseConciliationFilePreview(previewResult.value);
  return preview && preview.archivo_id === fileId
    ? jsonResponse(preview)
    : errorResponse(ERROR_PAYLOADS.internal, 500);
}
