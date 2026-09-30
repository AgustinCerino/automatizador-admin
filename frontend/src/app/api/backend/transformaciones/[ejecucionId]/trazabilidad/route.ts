import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleGetTransformationTraceRequest } from "@/lib/api/authenticated-route-handlers";

interface TransformationTraceRouteContext {
  params: Promise<{ ejecucionId: string }>;
}

export async function GET(
  _request: Request,
  context: TransformationTraceRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleGetTransformationTraceRequest(
    ejecucionId,
    authenticatedRouteDependencies,
  );
}
