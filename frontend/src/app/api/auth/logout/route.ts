import { clearSessionToken } from "@/lib/auth/cookies";
import { handleLogoutRequest } from "@/lib/auth/route-handlers";

export async function POST(request: Request): Promise<Response> {
  return handleLogoutRequest(request, { clearSessionToken });
}
