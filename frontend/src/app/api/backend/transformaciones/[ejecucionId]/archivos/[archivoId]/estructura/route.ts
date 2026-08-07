import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleInspectTransformationSourceFileRequest } from "@/lib/api/authenticated-route-handlers";

interface SourceStructureRouteContext {
  params: Promise<{ archivoId: string; ejecucionId: string }>;
}

export async function GET(
  request: Request,
  context: SourceStructureRouteContext,
): Promise<Response> {
  const { archivoId, ejecucionId } = await context.params;
  return handleInspectTransformationSourceFileRequest(
    request,
    ejecucionId,
    archivoId,
    authenticatedRouteDependencies,
  );
}
