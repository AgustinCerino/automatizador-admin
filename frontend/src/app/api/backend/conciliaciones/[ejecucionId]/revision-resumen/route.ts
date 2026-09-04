import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleGetConciliationRevisionSummaryRequest } from "@/lib/api/authenticated-route-handlers";

export async function GET(_request: Request, context: { params: Promise<{ ejecucionId: string }> }): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleGetConciliationRevisionSummaryRequest(ejecucionId, authenticatedRouteDependencies);
}
