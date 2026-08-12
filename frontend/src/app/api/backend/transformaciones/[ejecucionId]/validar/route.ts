import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleValidateTransformationConfigurationRequest } from "@/lib/api/authenticated-route-handlers";

interface TransformationValidationRouteContext {
  params: Promise<{ ejecucionId: string }>;
}

export async function POST(
  request: Request,
  context: TransformationValidationRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleValidateTransformationConfigurationRequest(
    request,
    ejecucionId,
    authenticatedRouteDependencies,
  );
}
