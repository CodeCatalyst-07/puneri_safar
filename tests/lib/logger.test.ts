import { describe, it, expect, vi } from "vitest";
import { sanitizeLogData, logger } from "@/lib/logger";

describe("sanitizeLogData Security & Privacy Redaction", () => {
  it("redacts sensitive credential keys in context objects", () => {
    const rawData = {
      user: "arnav",
      apiKey: "mock_secret_api_key_value",
      gemini_token: "secret_gemini_token_value",
      password: "SuperSecretPassword123!",
      auth_header: "Bearer eyJhbGciOi...",
      privateKey: "-----BEGIN PRIVATE KEY-----...",
      metadata: {
        api_secret: "hidden_secret",
      },
    };

    const sanitized = sanitizeLogData(rawData) as Record<string, unknown>;

    expect(sanitized.user).toBe("arnav");
    expect(sanitized.apiKey).toBe("[REDACTED_SECRET]");
    expect(sanitized.gemini_token).toBe("[REDACTED_SECRET]");
    expect(sanitized.password).toBe("[REDACTED_SECRET]");
    expect(sanitized.auth_header).toBe("[REDACTED_SECRET]");
    expect(sanitized.privateKey).toBe("[REDACTED_SECRET]");
    expect((sanitized.metadata as Record<string, unknown>).api_secret).toBe("[REDACTED_SECRET]");
  });

  it("redacts precise raw GPS coordinates from coordinate keys", () => {
    const context = {
      areaName: "Koregaon Park",
      lat: 18.5362,
      lng: 73.8941,
      latitude: 18.536214,
      longitude: 73.894129,
      coordinates: [18.5362, 73.8941],
    };

    const sanitized = sanitizeLogData(context) as Record<string, unknown>;

    expect(sanitized.areaName).toBe("Koregaon Park");
    expect(sanitized.lat).toBe("[REDACTED_COORDINATES]");
    expect(sanitized.lng).toBe("[REDACTED_COORDINATES]");
    expect(sanitized.latitude).toBe("[REDACTED_COORDINATES]");
    expect(sanitized.longitude).toBe("[REDACTED_COORDINATES]");
    expect(sanitized.coordinates).toBe("[REDACTED_COORDINATES]");
  });

  it("redacts inline GPS coordinate patterns embedded in string messages", () => {
    const message = "User triggered route calculation from 18.52043, 73.85674 to destination";
    const sanitized = sanitizeLogData(message);

    expect(sanitized).toBe(
      "User triggered route calculation from [REDACTED_COORDINATES] to destination"
    );
  });

  it("handles circular references gracefully without crashing", () => {
    const circularObj: Record<string, unknown> = { name: "Pune" };
    circularObj.self = circularObj;

    const sanitized = sanitizeLogData(circularObj) as Record<string, unknown>;
    expect(sanitized.name).toBe("Pune");
    expect(sanitized.self).toBe("[CIRCULAR_REFERENCE]");
  });

  it("logs structured JSON to console without throwing", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(() => {
      logger.info("Test city insight event", { neighborhood: "Shivajinagar", rating: 4.8 });
    }).not.toThrow();

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
    spy.mockRestore();
  });
});
