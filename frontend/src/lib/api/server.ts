import "server-only";

import {
  executeBackendRequest,
  executeBackendRequestWithToken,
  type BackendFetchOptions,
} from "@/lib/api/server-utils";

export type { BackendFetchOptions } from "@/lib/api/server-utils";

export async function backendFetch(
  backendPath: string,
  options: BackendFetchOptions = {},
): Promise<Response> {
  return executeBackendRequest(
    process.env.BACKEND_URL,
    backendPath,
    options,
  );
}

export async function backendFetchWithToken(
  backendPath: string,
  token: string,
  options: BackendFetchOptions = {},
): Promise<Response> {
  return executeBackendRequestWithToken(
    process.env.BACKEND_URL,
    backendPath,
    token,
    options,
  );
}
