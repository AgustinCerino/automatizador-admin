import "server-only";

import type { CurrentUser } from "@/features/auth/types";
import { getCurrentUserFromBackend } from "@/lib/auth/backend";
import { readSessionToken } from "@/lib/auth/cookies";

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
