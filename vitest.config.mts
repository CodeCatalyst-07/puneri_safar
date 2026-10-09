import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    env: {
      GEMINI_API_KEY: "mock_gemini_key",
      GEMINI_MODEL: "gemini-2.5-flash",
      GOOGLE_MAPS_SERVER_KEY: "mock_maps_server_key",
      NEXT_PUBLIC_GOOGLE_MAPS_KEY: "mock_client_maps_key",
      NODE_ENV: "test",
    },
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/core/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/core/index.ts", "src/core/context/**"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
