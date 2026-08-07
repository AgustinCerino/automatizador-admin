import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleGetTransformationSummaryRequest } from "@/lib/api/authenticated-route-handlers";

interface TransformationSummaryRouteContext {
  params: Promise<{ ejecucionId: string }>;
}

export async function GET(
  _request: Request,
  context: TransformationSummaryRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleGetTransformationSummaryRequest(
    ejecucionId,
    authenticatedRouteDependencies,
  );
}
