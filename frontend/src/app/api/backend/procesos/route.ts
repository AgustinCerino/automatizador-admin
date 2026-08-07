import { handleListProcessesRequest } from "@/lib/api/authenticated-route-handlers";
import { authenticatedRouteDependencies } from "@/lib/api/authenticated-route-dependencies";

export async function GET(request: Request): Promise<Response> {
  return handleListProcessesRequest(request, authenticatedRouteDependencies);
}
