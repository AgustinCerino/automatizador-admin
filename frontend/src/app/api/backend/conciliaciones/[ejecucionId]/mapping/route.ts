import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import {
  handleGetConciliationMappingRequest,
  handleSaveConciliationMappingRequest,
} from "@/lib/api/authenticated-route-handlers";

interface ConciliationMappingRouteContext {
  params: Promise<{ ejecucionId: string }>;
}

export async function GET(
  _request: Request,
  context: ConciliationMappingRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleGetConciliationMappingRequest(
    ejecucionId,
    authenticatedRouteDependencies,
  );
}

export async function POST(
  request: Request,
  context: ConciliationMappingRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleSaveConciliationMappingRequest(
    request,
    ejecucionId,
    authenticatedRouteDependencies,
  );
}
