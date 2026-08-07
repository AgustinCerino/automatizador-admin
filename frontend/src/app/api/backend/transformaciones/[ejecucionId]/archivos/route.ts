import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import {
  handleListTransformationSourceFilesRequest,
  handleUploadTransformationSourceFileRequest,
} from "@/lib/api/authenticated-route-handlers";

interface SourceFilesRouteContext {
  params: Promise<{ ejecucionId: string }>;
}

export async function GET(
  _request: Request,
  context: SourceFilesRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleListTransformationSourceFilesRequest(
    ejecucionId,
    authenticatedRouteDependencies,
  );
}

export async function POST(
  request: Request,
  context: SourceFilesRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleUploadTransformationSourceFileRequest(
    request,
    ejecucionId,
    authenticatedRouteDependencies,
  );
}
