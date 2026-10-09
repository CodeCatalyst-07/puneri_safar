/**
 * @file src/app/api/health/route.ts
 * Health check endpoint reporting service status and configured integrations.
 *
 * GET /api/health
 */

import { jsonSuccess } from "@/lib/http";
import { env } from "@/lib/env";
import { getReportsRepositoryType } from "@/adapters/reports";

export const dynamic = "force-dynamic";

export async function GET() {
  let hasGemini = false;
  let hasGoogleMaps = false;
  let hasGroq = false;

  try {
    const s = env.server;
    hasGemini = Boolean(s.GEMINI_API_KEY && !s.GEMINI_API_KEY.includes("dummy"));
    hasGoogleMaps = Boolean(
      s.GOOGLE_MAPS_SERVER_KEY && !s.GOOGLE_MAPS_SERVER_KEY.includes("dummy")
    );
    hasGroq = Boolean(s.GROQ_API_KEY && !s.GROQ_API_KEY.includes("dummy"));
  } catch {
    // If running in minimal environment without server env validation
  }

  const repositoryType = getReportsRepositoryType();

  const integrations: Record<string, boolean> = {
    gemini: hasGemini,
    googleMaps: hasGoogleMaps,
    firebase: repositoryType === "firestore",
  };

  // Only include Groq if explicitly configured
  if (hasGroq) {
    integrations.groq = true;
  }

  const healthData = {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV ?? "development",
    version: "0.1.0",
    repository: repositoryType,
    integrations,
  };

  return jsonSuccess(healthData, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
