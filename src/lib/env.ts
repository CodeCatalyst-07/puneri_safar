import { z } from "zod";

/**
 * Server-only environment variables schema.
 * These keys must never be exposed to the browser or prefixed with NEXT_PUBLIC_.
 */
export const serverEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required for generative AI features"),
  GEMINI_MODEL: z
    .string()
    .min(1, "GEMINI_MODEL must be configured (e.g., gemini-2.5-flash; never hardcode model name)"),
  GROQ_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(["gemini", "groq"]).default("gemini"),
  GOOGLE_MAPS_SERVER_KEY: z
    .string()
    .min(1, "GOOGLE_MAPS_SERVER_KEY is required for backend Places and Routes API calls"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/**
 * Client-accessible environment variables schema.
 * These variables MUST be prefixed with NEXT_PUBLIC_ and are bundled into client code.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_GOOGLE_MAPS_KEY is required for Google Maps client components"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type AppEnv = ServerEnv & ClientEnv;

/**
 * Formats Zod errors into a prominent, readable error message.
 */
export function formatEnvErrors(issues: z.ZodIssue[]): string {
  const errorLines = issues.map((issue) => {
    const field = issue.path.join(".");
    return `  ✖ ${field}: ${issue.message}`;
  });

  return [
    "\n=================================================================",
    "❌ [Puneri Safar] MISSING OR INVALID ENVIRONMENT VARIABLES",
    "-----------------------------------------------------------------",
    ...errorLines,
    "-----------------------------------------------------------------",
    "👉 Copy .env.example to .env.local and populate the required keys.",
    "=================================================================\n",
  ].join("\n");
}

/**
 * Validates arbitrary environment variables against server and client schemas.
 * Pure function designed for startup validation and unit testing.
 */
export function validateEnv(rawEnv: Record<string, string | undefined> = process.env): {
  server: ServerEnv;
  client: ClientEnv;
} {
  const isServer = typeof window === "undefined";

  const clientResult = clientEnvSchema.safeParse(rawEnv);
  if (!clientResult.success) {
    const errorMsg = formatEnvErrors(clientResult.error.issues);
    throw new Error(errorMsg);
  }

  if (!isServer) {
    // When executing in browser context, server env is unavailable
    return {
      server: {} as ServerEnv,
      client: clientResult.data,
    };
  }

  const serverResult = serverEnvSchema.safeParse(rawEnv);
  if (!serverResult.success) {
    const errorMsg = formatEnvErrors(serverResult.error.issues);
    throw new Error(errorMsg);
  }

  return {
    server: serverResult.data,
    client: clientResult.data,
  };
}

/**
 * Resolves environment variables.
 * SKIP_ENV_VALIDATION is strictly honored ONLY during Next.js production build phase
 * (i.e. NEXT_PHASE === 'phase-production-build').
 * At runtime in any environment, SKIP_ENV_VALIDATION is ignored and validation fails fast.
 */
export function initializeEnv(rawEnv: Record<string, string | undefined> = process.env): {
  server: ServerEnv;
  client: ClientEnv;
} {
  const isNextProductionBuild = rawEnv.NEXT_PHASE === "phase-production-build";

  if (rawEnv.SKIP_ENV_VALIDATION === "true" && isNextProductionBuild) {
    return {
      server: {
        GEMINI_API_KEY: rawEnv.GEMINI_API_KEY || "build_dummy_gemini_key",
        GEMINI_MODEL: rawEnv.GEMINI_MODEL || "gemini-2.5-flash",
        GROQ_API_KEY: rawEnv.GROQ_API_KEY,
        LLM_PROVIDER: (rawEnv.LLM_PROVIDER as "gemini" | "groq") || "gemini",
        GOOGLE_MAPS_SERVER_KEY: rawEnv.GOOGLE_MAPS_SERVER_KEY || "build_dummy_maps_server_key",
        FIREBASE_PROJECT_ID: rawEnv.FIREBASE_PROJECT_ID || "puneri-safar-dev",
        FIREBASE_CLIENT_EMAIL:
          rawEnv.FIREBASE_CLIENT_EMAIL || "dummy@puneri-safar-dev.iam.gserviceaccount.com",
        FIREBASE_PRIVATE_KEY: rawEnv.FIREBASE_PRIVATE_KEY || "build_dummy_private_key",
        NODE_ENV: (rawEnv.NODE_ENV as "development" | "test" | "production") || "development",
      },
      client: {
        NEXT_PUBLIC_GOOGLE_MAPS_KEY:
          rawEnv.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "build_dummy_client_maps_key",
      },
    };
  }

  return validateEnv(rawEnv);
}

// Startup validation singleton
let cachedEnv: { server: ServerEnv; client: ClientEnv } | null = null;

export function getEnv(): { server: ServerEnv; client: ClientEnv } {
  if (!cachedEnv) {
    cachedEnv = initializeEnv(process.env);
  }
  return cachedEnv;
}

export function resetCachedEnv(): void {
  cachedEnv = null;
}

export const env = {
  get server(): ServerEnv {
    if (typeof window !== "undefined") {
      throw new Error(
        "Security Violation: Attempted to access server environment variable in client code."
      );
    }
    return getEnv().server;
  },
  get client(): ClientEnv {
    return getEnv().client;
  },
};
