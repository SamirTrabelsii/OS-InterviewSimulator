import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Active les tests d'intégration si .env.local définit DATABASE_URL.
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

// Tests qui lancent de vrais processus du bac à sable (Pyodide, sql.js).
const SANDBOX_TESTS = ["src/server/sandbox/**/*.test.ts", "src/server/grading/**/*.test.ts", "src/app/api/session/gemmes/code.test.ts"];

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
          exclude: ["tests/build/**", "node_modules/**", ...SANDBOX_TESTS],
          sequence: { groupOrder: 0 },
        },
      },
      {
        // Bac à sable : vrais processus Pyodide, gourmands en CPU. Lancés
        // après les autres pour ne pas leur faire dépasser leurs délais.
        extends: true,
        test: {
          name: "sandbox",
          include: SANDBOX_TESTS,
          // Un fichier à la fois : leurs délais (5 s Python) sont mesurés en
          // temps réel et ne supportent pas plusieurs pools en concurrence.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
