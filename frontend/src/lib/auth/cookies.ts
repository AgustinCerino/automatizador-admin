import "server-only";

import { cookies } from "next/headers";

import {
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/cookie-config";
import { isSafeBearerToken } from "@/lib/auth/backend-contract";

export async function readSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function setSessionToken(token: string): Promise<void> {
  if (!isSafeBearerToken(token)) {
    throw new TypeError("El token de sesión no es válido.");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

export async function clearSessionToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: SESSION_COOKIE_NAME,
    ...getSessionCookieOptions(),
  });
}
