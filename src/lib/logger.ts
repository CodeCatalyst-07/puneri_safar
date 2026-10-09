export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    code?: string;
  };
}

const SENSITIVE_KEY_PATTERNS = [
  /key/i,
  /token/i,
  /secret/i,
  /auth/i,
  /password/i,
  /bearer/i,
  /credential/i,
  /private/i,
  /cookie/i,
];

const COORDINATE_KEY_PATTERNS = [
  /^lat$/i,
  /^lng$/i,
  /^latitude$/i,
  /^longitude$/i,
  /^coords$/i,
  /^coordinates$/i,
  /^raw_location$/i,
];

// Matches typical GPS coordinate strings like "18.52043, 73.85674"
const COORDINATE_STRING_PATTERN =
  /[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)/g;

/**
 * Recursively sanitizes data to prevent leaking secrets and raw precise GPS coordinates.
 */
export function sanitizeLogData(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    // Redact embedded coordinate pairs in string messages
    return value.replace(COORDINATE_STRING_PATTERN, "[REDACTED_COORDINATES]");
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message.replace(COORDINATE_STRING_PATTERN, "[REDACTED_COORDINATES]"),
    };
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[CIRCULAR_REFERENCE]";
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeLogData(item, seen));
    }

    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Check for secret keys
      if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        sanitizedObj[key] = "[REDACTED_SECRET]";
        continue;
      }

      // Check for raw user coordinates
      if (COORDINATE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
        sanitizedObj[key] = "[REDACTED_COORDINATES]";
        continue;
      }

      sanitizedObj[key] = sanitizeLogData(val, seen);
    }

    return sanitizedObj;
  }

  return String(value);
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private write(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    err?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message:
        typeof message === "string"
          ? message.replace(COORDINATE_STRING_PATTERN, "[REDACTED_COORDINATES]")
          : "",
    };

    if (context) {
      entry.context = sanitizeLogData(context) as Record<string, unknown>;
    }

    if (err) {
      entry.error = {
        name: err.name,
        message: err.message.replace(COORDINATE_STRING_PATTERN, "[REDACTED_COORDINATES]"),
        code: (err as { code?: string }).code,
      };
    }

    const jsonString = JSON.stringify(entry);

    if (level === "error") {
      console.error(jsonString);
    } else if (level === "warn") {
      console.warn(jsonString);
    } else if (level === "debug") {
      if (this.isDevelopment) {
        console.debug(jsonString);
      }
    } else {
      console.log(jsonString);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>, err?: Error): void {
    this.write("warn", message, context, err);
  }

  error(message: string, err?: Error, context?: Record<string, unknown>): void {
    this.write("error", message, context, err);
  }
}

export const logger = new Logger();
