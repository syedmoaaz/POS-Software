import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, isAppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "Route not found", "NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten(),
        requestId: req.requestId,
      },
    });
  }

  if (err instanceof SyntaxError && "status" in err && (err as { status?: number }).status === 400) {
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON body",
        requestId: req.requestId,
      },
    });
  }

  if (isAppError(err)) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: req.requestId }, err.message);
    }
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.requestId,
      },
    });
  }

  logger.error({ err, requestId: req.requestId }, "Unhandled error");
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId: req.requestId,
    },
  });
};
