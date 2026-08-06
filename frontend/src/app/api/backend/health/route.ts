import { handleHealthRequest } from "@/lib/api/health-route";
import { backendFetch } from "@/lib/api/server";

export async function GET(): Promise<Response> {
  return handleHealthRequest(backendFetch);
}
