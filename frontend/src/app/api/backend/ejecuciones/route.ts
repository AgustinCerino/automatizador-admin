import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";
import { handleCreateExecutionRequest } from "@/lib/api/authenticated-route-handlers";

export async function POST(request: Request): Promise<Response> {
  return handleCreateExecutionRequest(request, authenticatedRouteDependencies);
}
