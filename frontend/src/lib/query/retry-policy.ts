import { ApiError } from "@/lib/api/errors";

const RETRYABLE_HTTP_STATUSES = new Set([500, 502, 503, 504]);

export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= 1) {
    return false;
  }

  if (error instanceof ApiError) {
    return RETRYABLE_HTTP_STATUSES.has(error.status);
  }

  return error instanceof Error;
}
