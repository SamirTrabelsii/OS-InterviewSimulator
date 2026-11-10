import { defineConfig } from "vitest/config";
import base from "./vitest.config.mjs";

// Tests qui inspectent le résultat de `next build` (npm run test:build).
// Pas de mergeConfig : il additionnerait include/exclude au lieu de les remplacer.
export default defineConfig({
  resolve: base.resolve,
  test: { ...base.test, include: ["tests/build/**/*.test.ts"], exclude: ["node_modules/**"] },
});
