import type { components } from "@/types/generated/api";

export type LoginRequest = components["schemas"]["LoginRequest"];
export type TokenResponse = components["schemas"]["TokenResponse"];
export type UsuarioRead = components["schemas"]["UsuarioRead"];
export type AuthLoginRequest = LoginRequest;
export type AuthLoginBackendResponse = TokenResponse;
export type CurrentUser = UsuarioRead;
export type LoginSuccessResponse = Pick<TokenResponse, "user">;
