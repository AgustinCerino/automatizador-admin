import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleGetExecutionRequest } from "@/lib/api/authenticated-route-handlers";

interface ExecutionRouteContext {
  params: Promise<{ ejecucionId: string }>;
}

export async function GET(
  _request: Request,
  context: ExecutionRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleGetExecutionRequest(
    ejecucionId,
    authenticatedRouteDependencies,
  );
}
