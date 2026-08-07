export const SESSION_COOKIE_NAME = "automatizador_session";

export type SessionCookieOptions = Readonly<{
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
}>;

export function getSessionCookieOptions(
  environment = process.env.NODE_ENV,
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: environment === "production",
    path: "/",
  };
}
