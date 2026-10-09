import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("Health Check API Route", () => {
  it("returns 200 OK with runtime metadata", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.data.version).toBe("0.1.0");
    expect(typeof body.data.uptime).toBe("number");
    expect(body.data.timestamp).toBeDefined();
    expect(body.data.integrations).toBeDefined();
    expect(typeof body.data.integrations.gemini).toBe("boolean");
    expect(typeof body.data.integrations.googleMaps).toBe("boolean");
    expect(typeof body.data.integrations.firebase).toBe("boolean");
    expect(["firestore", "memory"]).toContain(body.data.repository);
  });
});
