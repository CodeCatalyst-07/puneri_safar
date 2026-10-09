import { describe, it, expect } from "vitest";
import { jsonSuccess, jsonError } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";
import { z } from "zod";

describe("HTTP Response Helpers", () => {
  it("formats standard jsonSuccess responses", async () => {
    const response = jsonSuccess({ city: "Pune", status: "active" }, { status: 201 });
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ city: "Pune", status: "active" });
  });

  it("handles known operational AppError safely", async () => {
    const error = new NotFoundError("Heritage site not found");
    const response = jsonError(error);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Heritage site not found");
  });

  it("handles Zod validation errors with structured details", async () => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse({ email: "invalid-email" });

    if (!parsed.success) {
      const response = jsonError(parsed.error);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details).toBeDefined();
    }
  });

  it("sanitizes unexpected internal errors to avoid leaking stack traces", async () => {
    const internalSecretError = new Error("FATAL: database password incorrect at connection pool");
    const response = jsonError(internalSecretError);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    // Ensure stack trace is NOT leaked in the payload
    expect(body.error.stack).toBeUndefined();
  });
});
