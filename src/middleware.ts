import { defineMiddleware } from "astro:middleware";
import { logEvent } from "./lib/observability";

export const onRequest = defineMiddleware(async (context, next) => {
  const requestId = context.request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  context.locals.requestId = requestId;
  const startedAt = Date.now();
  let response: Response;

  try {
    response = await next();
  } catch (error) {
    logEvent("http_request_failed", {
      requestId,
      method: context.request.method,
      path: new URL(context.request.url).pathname,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  logEvent("http_request", {
    requestId,
    method: context.request.method,
    path: new URL(context.request.url).pathname,
    status: response.status,
    durationMs: Date.now() - startedAt,
  });

  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
