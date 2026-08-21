import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleDownloadTransformationResultRequest } from "@/lib/api/authenticated-route-handlers";

interface RouteContext { params: Promise<{ ejecucionId: string }>; }

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleDownloadTransformationResultRequest(ejecucionId, authenticatedRouteDependencies);
}
