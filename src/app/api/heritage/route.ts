/**
 * @file src/app/api/heritage/route.ts
 * Serves verified Pune cultural and historical heritage sites with cache headers.
 */

import { jsonSuccess } from "@/lib/http";
import { staticHeritageSites } from "@/data";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  return jsonSuccess(staticHeritageSites, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
    meta: {
      total: staticHeritageSites.length,
      source: "Archaeological Survey of India & PMC Heritage Cell",
    },
  });
}
