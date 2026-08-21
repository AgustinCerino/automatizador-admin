import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleGenerateTransformationResultRequest } from "@/lib/api/authenticated-route-handlers";

interface RouteContext { params: Promise<{ ejecucionId: string }>; }

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleGenerateTransformationResultRequest(request, ejecucionId, authenticatedRouteDependencies);
}
