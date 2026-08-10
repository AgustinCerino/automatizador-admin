import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import {
  handleGetTransformationConfigurationRequest,
  handleSaveTransformationConfigurationRequest,
} from "@/lib/api/authenticated-route-handlers";

interface TransformationConfigurationRouteContext {
  params: Promise<{ ejecucionId: string }>;
}

export async function GET(
  _request: Request,
  context: TransformationConfigurationRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleGetTransformationConfigurationRequest(
    ejecucionId,
    authenticatedRouteDependencies,
  );
}

export async function POST(
  request: Request,
  context: TransformationConfigurationRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleSaveTransformationConfigurationRequest(
    request,
    ejecucionId,
    authenticatedRouteDependencies,
  );
}
