import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleGetProcessRequest } from "@/lib/api/authenticated-route-handlers";

interface ProcessRouteContext {
  params: Promise<{ procesoId: string }>;
}

export async function GET(
  _request: Request,
  context: ProcessRouteContext,
): Promise<Response> {
  const { procesoId } = await context.params;
  return handleGetProcessRequest(procesoId, authenticatedRouteDependencies);
}
