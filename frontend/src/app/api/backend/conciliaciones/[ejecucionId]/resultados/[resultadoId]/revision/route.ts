import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleUpdateConciliationRevisionRequest } from "@/lib/api/authenticated-route-handlers";

export async function PATCH(request: Request, context: { params: Promise<{ ejecucionId: string; resultadoId: string }> }): Promise<Response> {
  const { ejecucionId, resultadoId } = await context.params;
  return handleUpdateConciliationRevisionRequest(request, ejecucionId, resultadoId, authenticatedRouteDependencies);
}
