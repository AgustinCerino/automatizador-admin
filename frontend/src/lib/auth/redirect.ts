const DEFAULT_INTERNAL_REDIRECT = "/";
const INTERNAL_ORIGIN = "https://automatizador.internal";
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export function sanitizeInternalRedirect(
  value: string | string[] | undefined | null,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return DEFAULT_INTERNAL_REDIRECT;
  }

  let decodedValue: string;

  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    return DEFAULT_INTERNAL_REDIRECT;
  }

  if (
    decodedValue.startsWith("//") ||
    decodedValue.includes("\\") ||
    CONTROL_CHARACTER_PATTERN.test(decodedValue)
  ) {
    return DEFAULT_INTERNAL_REDIRECT;
  }

  try {
    const redirectUrl = new URL(value, INTERNAL_ORIGIN);
    const serializedRedirect = `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;

    if (
      redirectUrl.origin !== INTERNAL_ORIGIN ||
      serializedRedirect !== value
    ) {
      return DEFAULT_INTERNAL_REDIRECT;
    }
  } catch {
    return DEFAULT_INTERNAL_REDIRECT;
  }

  return value;
}
