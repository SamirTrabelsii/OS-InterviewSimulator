import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { isDevUiEnabled } from "./devOnly";
import { integerScale } from "./scale";
import { SPRITES } from "./sprites";

const css = readFileSync("src/ui/pixel/tokens.css", "utf8");
const palette = Object.fromEntries([...css.matchAll(/--c-([a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));

describe("échelle pixel entière", () => {
  it("renvoie toujours un entier ≥ 1", () => {
    for (const [w, h] of [[320, 200], [1000, 700], [1919, 1079], [50, 50], [0, 0], [4000, 300]]) {
      const s = integerScale(w, h);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(1);
    }
  });
  it("choisit le plus grand facteur qui tient", () => {
    expect(integerScale(1000, 1000)).toBe(3); // 1000/320 = 3,1
    expect(integerScale(1000, 500)).toBe(2); // 500/200 = 2,5
    expect(integerScale(640, 400)).toBe(2);
    expect(integerScale(639, 400)).toBe(1);
  });
  it("tolère les valeurs absurdes", () => {
    expect(integerScale(NaN, 100)).toBe(1);
    expect(integerScale(Infinity, Infinity)).toBe(1);
  });
});

describe("palette", () => {
  it("reste limitée", () => {
    expect(Object.keys(palette).length).toBeLessThanOrEqual(32);
  });
  const bgs = ["bg-0", "bg-1", "bg-2", "surface-1", "surface-2", "surface-3"];
  it("les textes lisent à AA (≥ 4.5) sur tous les fonds", () => {
    for (const t of ["text", "text-dim", "text-mute"]) {
      for (const b of bgs) expect(contrastRatio(palette[t], palette[b]), `${t} sur ${b}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("les néons lisent à AA sur les fonds", () => {
    for (const n of ["cyan", "cyan-l", "green", "magenta", "amber", "amber-l", "danger"]) {
      for (const b of bgs) expect(contrastRatio(palette[n], palette[b]), `${n} sur ${b}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("le texte du bouton principal lit sur son fond", () => {
    expect(contrastRatio(palette["bg-0"], palette["cyan"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette["bg-0"], palette["cyan-l"])).toBeGreaterThanOrEqual(4.5);
  });
  it("le texte du bouton secondaire (et survol) lit sur son fond", () => {
    expect(contrastRatio(palette["text"], palette["surface-3"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette["text"], palette["line-2"])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("sprites", () => {
  it("chaque sprite du catalogue existe dans public/", () => {
    for (const [name, s] of Object.entries(SPRITES)) {
      expect(existsSync(`public${s.src}`), name).toBe(true);
    }
  });
});

describe("page de démonstration", () => {
  it("n'existe pas en production", () => {
    expect(isDevUiEnabled("production")).toBe(false);
    expect(isDevUiEnabled("development")).toBe(true);
    expect(isDevUiEnabled("test")).toBe(true);
  });
});
