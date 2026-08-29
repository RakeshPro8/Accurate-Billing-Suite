import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { logger } from "./logger";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}

type RequestSchemas = {
  params?: SafeParseSchema;
  query?: SafeParseSchema;
  body?: SafeParseSchema;
};

type SafeParseSchema = {
  safeParse(value: unknown):
    | { success: true; data: unknown }
    | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } };
};

export function validateRequest(schemas: RequestSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const targets = [
      ["params", schemas.params],
      ["query", schemas.query],
      ["body", schemas.body],
    ] as const;

    for (const [target, schema] of targets) {
      if (!schema) continue;
      const result = schema.safeParse(req[target]);
      if (!result.success) {
        return res.status(400).json({
          error: "Invalid request.",
          code: "INVALID_REQUEST",
          details: result.error.issues.slice(0, 8).map((issue) => ({
            path: [target, ...issue.path].join("."),
            message: issue.message,
          })),
        });
      }
      Object.defineProperty(req, target, {
        value: result.data,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return next();
  };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (res.headersSent) {
    _next(error);
    return;
  }
  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : "INTERNAL_ERROR";
  const message = error instanceof HttpError ? error.message : "The request could not be completed.";

  logger.error({
    err: error,
    requestId: req.id,
    employeeId: req.employee?.id,
    storeId: req.session?.storeId,
    method: req.method,
    path: req.originalUrl.split("?")[0],
  }, "API request failed");

  res.status(status).json({ error: message, code, requestId: req.id });
};
