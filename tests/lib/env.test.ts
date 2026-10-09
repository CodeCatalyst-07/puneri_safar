import { describe, it, expect } from "vitest";
import {
  validateEnv,
  formatEnvErrors,
  serverEnvSchema,
  clientEnvSchema,
  initializeEnv,
} from "@/lib/env";

describe("Environment Variable Validation (Zod)", () => {
  const validMockEnv = {
    GEMINI_API_KEY: "mock_gemini_key",
    GEMINI_MODEL: "gemini-2.5-flash",
    GROQ_API_KEY: "mock_groq_key",
    LLM_PROVIDER: "gemini",
    GOOGLE_MAPS_SERVER_KEY: "mock_maps_server_key",
    NEXT_PUBLIC_GOOGLE_MAPS_KEY: "mock_maps_client_key",
    FIREBASE_PROJECT_ID: "puneri-safar-dev",
    FIREBASE_CLIENT_EMAIL: "admin@puneri-safar-dev.iam.gserviceaccount.com",
    FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...",
    NODE_ENV: "test",
  };

  it("passes validation with complete valid environment variables", () => {
    const validated = validateEnv(validMockEnv);
    expect(validated.server.GEMINI_API_KEY).toBe("mock_gemini_key");
    expect(validated.server.GEMINI_MODEL).toBe("gemini-2.5-flash");
    expect(validated.server.LLM_PROVIDER).toBe("gemini");
    expect(validated.client.NEXT_PUBLIC_GOOGLE_MAPS_KEY).toBe("mock_maps_client_key");
  });

  it("fails fast with clear error message when required server variables are missing", () => {
    const incompleteEnv = {
      ...validMockEnv,
      GEMINI_API_KEY: "",
      FIREBASE_PRIVATE_KEY: "",
    };

    expect(() => validateEnv(incompleteEnv)).toThrowError(
      /MISSING OR INVALID ENVIRONMENT VARIABLES/
    );
  });

  it("fails when client variable NEXT_PUBLIC_GOOGLE_MAPS_KEY is missing", () => {
    const missingClientEnv = {
      ...validMockEnv,
      NEXT_PUBLIC_GOOGLE_MAPS_KEY: "",
    };

    expect(() => validateEnv(missingClientEnv)).toThrowError(/NEXT_PUBLIC_GOOGLE_MAPS_KEY/);
  });

  it("validates LLM_PROVIDER enum constraint strictly", () => {
    const invalidProviderEnv = {
      ...validMockEnv,
      LLM_PROVIDER: "unsupported_provider",
    };

    expect(() => validateEnv(invalidProviderEnv)).toThrow();
  });

  it("formats Zod issues into clear human-readable guidance with Puneri Safar branding", () => {
    const serverResult = serverEnvSchema.safeParse({});
    expect(serverResult.success).toBe(false);
    if (!serverResult.success) {
      const formatted = formatEnvErrors(serverResult.error.issues);
      expect(formatted).toContain("Puneri Safar");
      expect(formatted).toContain("GEMINI_API_KEY");
      expect(formatted).toContain("GOOGLE_MAPS_SERVER_KEY");
      expect(formatted).toContain("👉 Copy .env.example to .env.local");
    }

    const clientResult = clientEnvSchema.safeParse({});
    expect(clientResult.success).toBe(false);
  });

  it("passes validation even when optional Firebase credentials are unset", () => {
    const noFirebaseEnv = {
      ...validMockEnv,
      FIREBASE_PROJECT_ID: undefined,
      FIREBASE_CLIENT_EMAIL: undefined,
      FIREBASE_PRIVATE_KEY: undefined,
    };
    const validated = validateEnv(noFirebaseEnv);
    expect(validated.server.FIREBASE_PROJECT_ID).toBeUndefined();
    expect(validated.server.FIREBASE_CLIENT_EMAIL).toBeUndefined();
    expect(validated.server.FIREBASE_PRIVATE_KEY).toBeUndefined();
  });

  it("honors SKIP_ENV_VALIDATION strictly ONLY during next build phase", () => {
    // 1. Honored when NEXT_PHASE is phase-production-build
    const buildEnv = {
      SKIP_ENV_VALIDATION: "true",
      NEXT_PHASE: "phase-production-build",
    };
    const resolvedBuild = initializeEnv(buildEnv);
    expect(resolvedBuild.server.GEMINI_API_KEY).toBe("build_dummy_gemini_key");
    expect(resolvedBuild.client.NEXT_PUBLIC_GOOGLE_MAPS_KEY).toBe("build_dummy_client_maps_key");

    // 2. MUST BE IGNORED at runtime (when NEXT_PHASE is not phase-production-build)
    const runtimeEnvWithBypassAttempt = {
      SKIP_ENV_VALIDATION: "true",
      NEXT_PHASE: "phase-development-server", // Or production server / undefined
      GEMINI_API_KEY: "",
    };

    expect(() => initializeEnv(runtimeEnvWithBypassAttempt)).toThrowError(
      /MISSING OR INVALID ENVIRONMENT VARIABLES/
    );
  });
});
