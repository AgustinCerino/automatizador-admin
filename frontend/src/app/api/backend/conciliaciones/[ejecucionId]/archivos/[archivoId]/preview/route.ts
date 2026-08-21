import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleGetConciliationPreviewRequest } from "@/lib/api/authenticated-route-handlers";

interface ConciliationPreviewRouteContext {
  params: Promise<{ archivoId: string; ejecucionId: string }>;
}

export async function GET(
  _request: Request,
  context: ConciliationPreviewRouteContext,
): Promise<Response> {
  const { archivoId, ejecucionId } = await context.params;
  return handleGetConciliationPreviewRequest(
    ejecucionId,
    archivoId,
    authenticatedRouteDependencies,
  );
}
