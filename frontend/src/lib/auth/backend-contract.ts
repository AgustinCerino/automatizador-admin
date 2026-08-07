import type {
  AuthLoginBackendResponse,
  CurrentUser,
} from "@/features/auth/types";

export type CurrentUserLookup =
  | { status: "authenticated"; user: CurrentUser }
  | { status: "invalid" }
  | { status: "forbidden" };

export class AuthBackendResponseError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("El backend devolvió una respuesta de autenticación inesperada.");
    this.name = "AuthBackendResponseError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCurrentUser(value: unknown): CurrentUser | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    !Number.isInteger(value.id) ||
    typeof value.cliente_id !== "number" ||
    !Number.isInteger(value.cliente_id) ||
    typeof value.nombre !== "string" ||
    typeof value.email !== "string" ||
    typeof value.rol !== "string" ||
    typeof value.estado !== "string"
  ) {
    return undefined;
  }

  return {
    cliente_id: value.cliente_id,
    email: value.email,
    estado: value.estado,
    id: value.id,
    nombre: value.nombre,
    rol: value.rol,
  };
}

export function isSafeBearerToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 16_384 &&
    value === value.trim() &&
    !/[\r\n]/.test(value)
  );
}

export function isAuthLoginBackendResponse(
  value: unknown,
): value is AuthLoginBackendResponse {
  return (
    isRecord(value) &&
    isSafeBearerToken(value.access_token) &&
    typeof value.token_type === "string" &&
    parseCurrentUser(value.user) !== undefined
  );
}
