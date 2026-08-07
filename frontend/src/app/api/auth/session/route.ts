import { getCurrentUserFromBackend } from "@/lib/auth/backend";
import {
  clearSessionToken,
  readSessionToken,
} from "@/lib/auth/cookies";
import { handleSessionRequest } from "@/lib/auth/route-handlers";

export async function GET(): Promise<Response> {
  return handleSessionRequest({
    clearSessionToken,
    getCurrentUser: getCurrentUserFromBackend,
    readSessionToken,
  });
}
