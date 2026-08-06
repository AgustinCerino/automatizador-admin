import "server-only";

import {
  executeBackendRequest,
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
