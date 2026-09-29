import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import {
  handleCreateTransformationTemplateRequest,
  handleListTransformationTemplatesRequest,
} from "@/lib/api/authenticated-route-handlers";

interface TemplatesRouteContext {
  params: Promise<{ ejecucionId: string }>;
}

export async function GET(
  _request: Request,
  context: TemplatesRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleListTransformationTemplatesRequest(
    ejecucionId,
    authenticatedRouteDependencies,
  );
}

export async function POST(
  request: Request,
  context: TemplatesRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleCreateTransformationTemplateRequest(
    request,
    ejecucionId,
    authenticatedRouteDependencies,
  );
}
