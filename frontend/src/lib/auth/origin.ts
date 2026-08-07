export function isSameOriginRequest(request: Request): boolean {
  const originHeader = request.headers.get("origin");

  if (originHeader === null) {
    return true;
  }

  try {
    const requestOrigin = new URL(request.url).origin;
    const parsedOrigin = new URL(originHeader);

    return originHeader === parsedOrigin.origin && parsedOrigin.origin === requestOrigin;
  } catch {
    return false;
  }
}
