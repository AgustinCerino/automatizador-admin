import "server-only";

import type { CurrentUser } from "@/features/auth/types";
import { BackendRequestError } from "@/lib/api/server-utils";
import { getCurrentUserFromBackend } from "@/lib/auth/backend";
import { AuthBackendResponseError } from "@/lib/auth/backend-contract";
import { readSessionToken } from "@/lib/auth/cookies";
import {
  RequiredSessionError,
  type AuthenticatedSession,
} from "@/lib/auth/session-contract";

export type ServerSession =
  | { authenticated: true; user: CurrentUser }
  | { authenticated: false; user: null };

export class ServerSessionError extends Error {
  constructor() {
    super("No se pudo verificar la sesión con el servidor.");
    this.name = "ServerSessionError";
  }
}

export async function getServerSession(): Promise<ServerSession> {
  const token = await readSessionToken();

  if (!token) {
    return { authenticated: false, user: null };
  }

  try {
    const lookup = await getCurrentUserFromBackend(token);

    if (lookup.status !== "authenticated") {
      return { authenticated: false, user: null };
    }

    return { authenticated: true, user: lookup.user };
  } catch {
    throw new ServerSessionError();
  }
}

export async function requireAuthenticatedSession(): Promise<AuthenticatedSession> {
  const token = await readSessionToken();

  if (!token) {
    throw new RequiredSessionError("unauthenticated");
  }

  try {
    const lookup = await getCurrentUserFromBackend(token);

    if (lookup.status === "invalid") {
      throw new RequiredSessionError("session-expired");
    }

    if (lookup.status === "forbidden") {
      throw new RequiredSessionError("forbidden");
    }

    return { token, user: lookup.user };
  } catch (error) {
    if (error instanceof RequiredSessionError) {
      throw error;
    }

    const isNetworkFailure =
      error instanceof BackendRequestError && error.kind !== "configuration";
    const isUnavailableResponse =
      error instanceof AuthBackendResponseError &&
      [502, 503, 504].includes(error.status);

    throw new RequiredSessionError(
      isNetworkFailure || isUnavailableResponse ? "unavailable" : "technical",
    );
  }
}
