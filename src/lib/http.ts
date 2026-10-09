import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { logger } from "./logger";

export interface ApiResponseSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiResponseError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Returns a standardized JSON success response.
 */
export function jsonSuccess<T>(
  data: T,
  init?: {
    status?: number;
    headers?: HeadersInit;
    meta?: Record<string, unknown>;
  }
): NextResponse<ApiResponseSuccess<T>> {
  const body: ApiResponseSuccess<T> = {
    success: true,
    data,
    ...(init?.meta ? { meta: init.meta } : {}),
  };

  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

/**
 * Returns a standardized JSON error response that never leaks internal stack traces or database errors.
 */
export function jsonError(
  error: unknown,
  fallbackStatus = 500,
  headers?: HeadersInit
): NextResponse<ApiResponseError> {
  // Handle known operational AppErrors
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(`AppError: ${error.message}`, error);
    } else {
      logger.warn(`Client Error [${error.code}]: ${error.message}`);
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      {
        status: error.statusCode,
        headers,
      }
    );
  }

  // Handle Zod validation errors cleanly
  if (error instanceof ZodError) {
    const formattedIssues = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    logger.warn("Validation error encountered", { issues: formattedIssues });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: formattedIssues,
        },
      },
      {
        status: 400,
        headers,
      }
    );
  }

  // Handle unexpected errors safely - NEVER leak error.stack or private internals
  const isDev = process.env.NODE_ENV === "development";
  const err = error instanceof Error ? error : new Error(String(error));

  logger.error("Unhandled server error", err);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: isDev ? err.message : "An unexpected internal server error occurred.",
      },
    },
    {
      status: fallbackStatus,
      headers,
    }
  );
}
