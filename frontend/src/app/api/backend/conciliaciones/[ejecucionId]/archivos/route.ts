import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import {
  handleGetConciliationSelectionRequest,
  handleSaveConciliationSelectionRequest,
} from "@/lib/api/authenticated-route-handlers";

interface ConciliationSelectionRouteContext {
  params: Promise<{ ejecucionId: string }>;
}

export async function GET(
  _request: Request,
  context: ConciliationSelectionRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleGetConciliationSelectionRequest(
    ejecucionId,
    authenticatedRouteDependencies,
  );
}

export async function PUT(
  request: Request,
  context: ConciliationSelectionRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleSaveConciliationSelectionRequest(
    request,
    ejecucionId,
    authenticatedRouteDependencies,
  );
}
