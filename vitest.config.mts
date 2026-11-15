import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const resolve = {
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)),
  },
};
export default defineConfig({
  test: {
    projects: [
      {
        resolve,
        test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        resolve,
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.tsx"],
          setupFiles: ["./tests/support/ui.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["./tests/support/integration.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
