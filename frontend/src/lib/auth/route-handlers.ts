import type {
  AuthLoginRequest,
  CurrentUser,
} from "@/features/auth/types";
import { loginSchema } from "@/features/auth/schemas/login-schema";
import {
  AuthBackendResponseError,
  isAuthLoginBackendResponse,
  parseCurrentUser,
  type CurrentUserLookup,
} from "@/lib/auth/backend-contract";
import { BackendRequestError } from "@/lib/api/server-utils";
import { isSameOriginRequest } from "@/lib/auth/origin";

interface SessionCookieDependencies {
  clearSessionToken: () => Promise<void>;
  readSessionToken: () => Promise<string | undefined>;
  setSessionToken: (token: string) => Promise<void>;
}

interface LoginDependencies
  extends Pick<
    SessionCookieDependencies,
    "clearSessionToken" | "setSessionToken"
  > {
  getCurrentUser: (token: string) => Promise<CurrentUserLookup>;
  login: (credentials: AuthLoginRequest) => Promise<Response>;
}

interface SessionDependencies
  extends Pick<
    SessionCookieDependencies,
    "clearSessionToken" | "readSessionToken"
  > {
  getCurrentUser: (token: string) => Promise<CurrentUserLookup>;
}

type LogoutDependencies = Pick<
  SessionCookieDependencies,
  "clearSessionToken"
>;

const INVALID_REQUEST = {
  code: "INVALID_REQUEST",
  message: "La solicitud no es válida.",
};

const INVALID_ORIGIN = {
  code: "INVALID_ORIGIN",
  message: "La solicitud no está permitida.",
};

const INVALID_CREDENTIALS = {
  code: "INVALID_CREDENTIALS",
  message: "El correo o la contraseña son incorrectos.",
};

const UNAUTHORIZED_SESSION = {
  code: "UNAUTHORIZED_SESSION",
  message: "No fue posible iniciar la sesión.",
};

const BACKEND_UNAVAILABLE = {
  code: "BACKEND_UNAVAILABLE",
  message: "El servidor no está disponible. Intentá nuevamente.",
};

const INTERNAL_ERROR = {
  code: "INTERNAL_SERVER_ERROR",
  message: "Ocurrió un error interno. Intentá nuevamente.",
};

const LOGIN_HEADERS = { "Cache-Control": "no-store" };
const SESSION_HEADERS = { "Cache-Control": "private, no-store" };

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: HeadersInit = LOGIN_HEADERS,
): Response {
  return Response.json(body, { headers, status });
}

function technicalErrorResponse(
  error: unknown,
  headers: HeadersInit = LOGIN_HEADERS,
): Response {
  const isNetworkFailure =
    error instanceof BackendRequestError && error.kind !== "configuration";
  const isUnavailableResponse =
    error instanceof AuthBackendResponseError &&
    [502, 503, 504].includes(error.status);

  if (isNetworkFailure || isUnavailableResponse) {
    return jsonResponse(BACKEND_UNAVAILABLE, 503, headers);
  }

  return jsonResponse(INTERNAL_ERROR, 500, headers);
}

async function clearPartialSession(
  clearSessionToken: () => Promise<void>,
): Promise<Response | undefined> {
  try {
    await clearSessionToken();
    return undefined;
  } catch {
    return jsonResponse(INTERNAL_ERROR, 500);
  }
}

export async function handleLoginRequest(
  request: Request,
  dependencies: LoginDependencies,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse(INVALID_ORIGIN, 403);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(INVALID_REQUEST, 400);
  }

  const validation = loginSchema.safeParse(body);

  if (!validation.success) {
    return jsonResponse(
      {
        code: "VALIDATION_ERROR",
        details: validation.error.flatten().fieldErrors,
        message: "Revisá los datos ingresados.",
      },
      422,
    );
  }

  let backendResponse: Response;

  try {
    backendResponse = await dependencies.login(validation.data);
  } catch (error) {
    return technicalErrorResponse(error);
  }

  if (backendResponse.status === 401) {
    return jsonResponse(INVALID_CREDENTIALS, 401);
  }

  if (backendResponse.status === 403) {
    return jsonResponse(UNAUTHORIZED_SESSION, 403);
  }

  if ([502, 503, 504].includes(backendResponse.status)) {
    return jsonResponse(BACKEND_UNAVAILABLE, 503);
  }

  if (!backendResponse.ok) {
    if (backendResponse.status === 422) {
      return jsonResponse(
        {
          code: "VALIDATION_ERROR",
          message: "Los datos enviados no son válidos.",
        },
        422,
      );
    }

    return jsonResponse(INTERNAL_ERROR, 500);
  }

  let payload: unknown;

  try {
    payload = await backendResponse.json();
  } catch {
    return jsonResponse(INTERNAL_ERROR, 500);
  }

  if (!isAuthLoginBackendResponse(payload)) {
    return jsonResponse(INTERNAL_ERROR, 500);
  }

  const token = payload.access_token;

  try {
    await dependencies.setSessionToken(token);
  } catch {
    return jsonResponse(INTERNAL_ERROR, 500);
  }

  let lookup: CurrentUserLookup;

  try {
    lookup = await dependencies.getCurrentUser(token);
  } catch (error) {
    const clearFailure = await clearPartialSession(
      dependencies.clearSessionToken,
    );

    return clearFailure ?? technicalErrorResponse(error);
  }

  if (lookup.status !== "authenticated") {
    const clearFailure = await clearPartialSession(
      dependencies.clearSessionToken,
    );

    if (clearFailure) {
      return clearFailure;
    }

    return lookup.status === "invalid"
      ? jsonResponse(INVALID_CREDENTIALS, 401)
      : jsonResponse(UNAUTHORIZED_SESSION, 403);
  }

  const user = parseCurrentUser(lookup.user);

  if (!user) {
    return jsonResponse(INTERNAL_ERROR, 500);
  }

  return jsonResponse({ user }, 200);
}

function unauthenticatedSessionResponse(): Response {
  return jsonResponse(
    { authenticated: false, user: null },
    200,
    SESSION_HEADERS,
  );
}

function authenticatedSessionResponse(user: CurrentUser): Response {
  const safeUser = parseCurrentUser(user);

  if (!safeUser) {
    return jsonResponse(INTERNAL_ERROR, 500, SESSION_HEADERS);
  }

  return jsonResponse(
    { authenticated: true, user: safeUser },
    200,
    SESSION_HEADERS,
  );
}

export async function handleSessionRequest(
  dependencies: SessionDependencies,
): Promise<Response> {
  const token = await dependencies.readSessionToken();

  if (!token) {
    return unauthenticatedSessionResponse();
  }

  let lookup: CurrentUserLookup;

  try {
    lookup = await dependencies.getCurrentUser(token);
  } catch (error) {
    return technicalErrorResponse(error, SESSION_HEADERS);
  }

  if (lookup.status === "authenticated") {
    return authenticatedSessionResponse(lookup.user);
  }

  try {
    await dependencies.clearSessionToken();
  } catch {
    return jsonResponse(INTERNAL_ERROR, 500, SESSION_HEADERS);
  }

  return unauthenticatedSessionResponse();
}

export async function handleLogoutRequest(
  request: Request,
  dependencies: LogoutDependencies,
): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return jsonResponse(INVALID_ORIGIN, 403);
  }

  try {
    await dependencies.clearSessionToken();
  } catch {
    return jsonResponse(INTERNAL_ERROR, 500);
  }

  return new Response(null, {
    headers: LOGIN_HEADERS,
    status: 204,
  });
}
