import "server-only";

import type { AuthLoginRequest } from "@/features/auth/types";
import { backendFetch, backendFetchWithToken } from "@/lib/api/server";
import {
  AuthBackendResponseError,
  isSafeBearerToken,
  parseCurrentUser,
  type CurrentUserLookup,
} from "@/lib/auth/backend-contract";

export async function loginWithBackend(
  credentials: AuthLoginRequest,
): Promise<Response> {
  return backendFetch("/auth/login", {
    body: JSON.stringify(credentials),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

export async function getCurrentUserFromBackend(
  token: string,
): Promise<CurrentUserLookup> {
  if (!isSafeBearerToken(token)) {
    return { status: "invalid" };
  }

  const response = await backendFetchWithToken("/auth/me", token, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    method: "GET",
  });

  if (response.status === 401) {
    return { status: "invalid" };
  }

  if (response.status === 403) {
    return { status: "forbidden" };
  }

  if (!response.ok) {
    throw new AuthBackendResponseError(response.status);
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new AuthBackendResponseError(502);
  }

  const user = parseCurrentUser(payload);

  if (!user) {
    throw new AuthBackendResponseError(502);
  }

  return { status: "authenticated", user };
}
