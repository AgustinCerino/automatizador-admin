import {
  getCurrentUserFromBackend,
  loginWithBackend,
} from "@/lib/auth/backend";
import {
  clearSessionToken,
  setSessionToken,
} from "@/lib/auth/cookies";
import { handleLoginRequest } from "@/lib/auth/route-handlers";

export async function POST(request: Request): Promise<Response> {
  return handleLoginRequest(request, {
    clearSessionToken,
    getCurrentUser: getCurrentUserFromBackend,
    login: loginWithBackend,
    setSessionToken,
  });
}
