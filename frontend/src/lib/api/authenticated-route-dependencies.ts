import "server-only";

import { backendFetchWithToken } from "@/lib/api/server";
import { clearSessionToken } from "@/lib/auth/cookies";
import { requireAuthenticatedSession } from "@/lib/auth/server-session";

export const authenticatedRouteDependencies = {
  clearSessionToken,
  fetchBackend: backendFetchWithToken,
  requireSession: requireAuthenticatedSession,
};
