export interface ApiErrorPayload {
  code?: string;
  message: string;
  details?: unknown;
}

export type ApiResponseType = "json" | "text" | "blob" | "void";

export type JsonRequestBody =
  | boolean
  | number
  | Record<string, unknown>
  | readonly unknown[];

export type ApiRequestBody = BodyInit | JsonRequestBody | null;

export interface ApiFetchOptions
  extends Omit<RequestInit, "body" | "credentials"> {
  body?: ApiRequestBody;
  responseType?: ApiResponseType;
}
