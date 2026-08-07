import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleListProcessExecutionsRequest } from "@/lib/api/authenticated-route-handlers";

interface ProcessExecutionsRouteContext {
  params: Promise<{ procesoId: string }>;
}

export async function GET(
  _request: Request,
  context: ProcessExecutionsRouteContext,
): Promise<Response> {
  const { procesoId } = await context.params;
  return handleListProcessExecutionsRequest(
    procesoId,
    authenticatedRouteDependencies,
  );
}
