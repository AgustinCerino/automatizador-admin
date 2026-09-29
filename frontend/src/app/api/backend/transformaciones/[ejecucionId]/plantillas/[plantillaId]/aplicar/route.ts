import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleApplyTransformationTemplateRequest } from "@/lib/api/authenticated-route-handlers";

interface ApplyTemplateRouteContext {
  params: Promise<{ ejecucionId: string; plantillaId: string }>;
}

export async function POST(
  request: Request,
  context: ApplyTemplateRouteContext,
): Promise<Response> {
  const { ejecucionId, plantillaId } = await context.params;
  return handleApplyTransformationTemplateRequest(
    request,
    ejecucionId,
    plantillaId,
    authenticatedRouteDependencies,
  );
}
