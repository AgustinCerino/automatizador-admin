import type { CurrentUser } from "@/features/auth/types";

export type RequiredSessionErrorKind =
  | "unauthenticated"
  | "session-expired"
  | "forbidden"
  | "unavailable"
  | "technical";

export interface AuthenticatedSession {
  token: string;
  user: CurrentUser;
}

export class RequiredSessionError extends Error {
  readonly kind: RequiredSessionErrorKind;

  constructor(kind: RequiredSessionErrorKind) {
    super("No se pudo obtener una sesión autenticada.");
    this.name = "RequiredSessionError";
    this.kind = kind;
  }
}
