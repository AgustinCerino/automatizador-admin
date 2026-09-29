import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import {
  handleDeactivateTransformationTemplateRequest,
  handleUpdateTransformationTemplateRequest,
} from "@/lib/api/authenticated-route-handlers";

interface TemplateRouteContext {
  params: Promise<{ ejecucionId: string; plantillaId: string }>;
}

export async function PUT(
  request: Request,
  context: TemplateRouteContext,
): Promise<Response> {
  const { ejecucionId, plantillaId } = await context.params;
  return handleUpdateTransformationTemplateRequest(
    request,
    ejecucionId,
    plantillaId,
    authenticatedRouteDependencies,
  );
}

export async function DELETE(
  request: Request,
  context: TemplateRouteContext,
): Promise<Response> {
  const { ejecucionId, plantillaId } = await context.params;
  return handleDeactivateTransformationTemplateRequest(
    request,
    ejecucionId,
    plantillaId,
    authenticatedRouteDependencies,
  );
}
