import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import {
  handleListConciliationFilesRequest,
  handleUploadConciliationFileRequest,
} from "@/lib/api/authenticated-route-handlers";

interface ConciliationFilesRouteContext {
  params: Promise<{ ejecucionId: string }>;
}

export async function GET(
  _request: Request,
  context: ConciliationFilesRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleListConciliationFilesRequest(
    ejecucionId,
    authenticatedRouteDependencies,
  );
}

export async function POST(
  request: Request,
  context: ConciliationFilesRouteContext,
): Promise<Response> {
  const { ejecucionId } = await context.params;
  return handleUploadConciliationFileRequest(
    request,
    ejecucionId,
    authenticatedRouteDependencies,
  );
}
