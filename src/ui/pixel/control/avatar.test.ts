import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../contrast";
import { AVATAR_SIZE, AVATAR_TONES, makeAvatar } from "./avatar";

describe("avatar pixel", () => {
  it("est déterministe", () => {
    expect(makeAvatar("session-1")).toEqual(makeAvatar("session-1"));
  });
  it("est symétrique et de la bonne taille", () => {
    for (const seed of ["a", "b", "c", "session-xyz", ""]) {
      const { cells } = makeAvatar(seed);
      expect(cells).toHaveLength(AVATAR_SIZE);
      for (const row of cells) {
        expect(row).toHaveLength(AVATAR_SIZE);
        expect([...row].reverse()).toEqual(row);
      }
    }
  });
  it("n'est jamais vide", () => {
    for (let i = 0; i < 200; i++) expect(makeAvatar(`s${i}`).cells.flat().some(Boolean)).toBe(true);
  });
  it("varie d'une graine à l'autre", () => {
    const set = new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(makeAvatar(`s${i}`).cells)));
    expect(set.size).toBeGreaterThan(20);
    for (let i = 0; i < 50; i++) expect(AVATAR_TONES).toContain(makeAvatar(`s${i}`).tone);
  });
});

describe("thème de contrôle (recruteur)", () => {
  const tokens = readFileSync("src/ui/pixel/tokens.css", "utf8");
  const palette = Object.fromEntries([...tokens.matchAll(/--c-([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
  it("les badges lisent à AA sur leur fond (texte néon sur bg-0, bg-0 sur néon plein)", () => {
    for (const n of ["cyan", "green", "amber", "magenta", "text-dim"]) {
      expect(contrastRatio(palette[n], palette["bg-0"]), `${n} sur bg-0`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("les liens et le texte lisent à AA sur le fond de page et les panneaux", () => {
    for (const b of ["bg-1", "surface-1"]) {
      for (const t of ["text", "text-dim", "cyan"]) expect(contrastRatio(palette[t], palette[b]), `${t} sur ${b}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("le thème garde le pixel à l'échelle entière 1 et aucune animation", () => {
    const css = readFileSync("src/ui/pixel/control/control.css", "utf8");
    expect(css).toMatch(/--ps:\s*1;/);
    expect(css).not.toMatch(/@keyframes|animation\s*:/);
  });
});
