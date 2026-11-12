import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Active les tests d'intégration si .env.local définit DATABASE_URL.
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@content": fileURLToPath(new URL("./content", import.meta.url)),
      // `server-only` lève une erreur hors de Next.js ; neutralisé en test.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Tests qui exigent un `next build` préalable : npm run test:build
    exclude: ["tests/build/**", "node_modules/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "content/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: ["tests/build/**", "node_modules/**", "src/server/sandbox/**"],
          sequence: { groupOrder: 0 },
        },
      },
      {
        // Bac à sable : vrais processus Pyodide, gourmands en CPU. Lancés
        // après les autres pour ne pas leur faire dépasser leurs délais.
        extends: true,
        test: {
          name: "sandbox",
          include: ["src/server/sandbox/**/*.test.ts"],
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
