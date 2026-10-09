/**
 * @file src/app/api/blackspots/route.ts
 * Serves official validated accident blackspots with HTTP cache headers.
 */

import { jsonSuccess } from "@/lib/http";
import { staticBlackspots } from "@/data";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  return jsonSuccess(staticBlackspots, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
    meta: {
      total: staticBlackspots.length,
      source: "Pune Traffic Police official road safety records",
    },
  });
}
