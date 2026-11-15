import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILDINGS, PROPS } from "@/engine/hub/world";
import { WORLD_ASSETS, assetUrl } from "./atlas";

describe("atlas du monde", () => {
  it("chaque graphisme du catalogue existe dans public/", () => {
    for (const name of WORLD_ASSETS) expect(existsSync(`public${assetUrl(name)}`), name).toBe(true);
  });
  it("les tailles logiques respectent le contrat (tuiles 8×8, bâtiments 64×48, portail 48×48, joueur 60×14)", () => {
    const size = (name: (typeof WORLD_ASSETS)[number]) => {
      const svg = readFileSync(`public${assetUrl(name)}`, "utf8");
      return [Number(/width="(\d+)"/.exec(svg)![1]), Number(/height="(\d+)"/.exec(svg)![1])];
    };
    for (const n of WORLD_ASSETS.filter((a) => a.startsWith("tile-"))) expect(size(n), n).toEqual([8, 8]);
    for (const n of WORLD_ASSETS.filter((a) => a.startsWith("building-"))) expect(size(n), n).toEqual([64, 48]);
    for (const n of WORLD_ASSETS.filter((a) => a.startsWith("portal-"))) expect(size(n), n).toEqual([48, 48]);
    expect(size("player")).toEqual([60, 14]);
    expect(size("prop-crate")).toEqual([12, 10]);
    expect(size("prop-vending")).toEqual([12, 18]);
    expect(size("prop-bench")).toEqual([24, 10]);
    expect(size("prop-plant")).toEqual([10, 14]);
    expect(size("prop-dumpster")).toEqual([20, 12]);
    expect(size("lamp")).toEqual([8, 24]);
  });
  it("chaque accessoire de décor désigne un sprite du catalogue", () => {
    for (const p of PROPS) expect((WORLD_ASSETS as readonly string[]).includes(p.sprite), p.sprite).toBe(true);
  });
  it("chaque bâtiment désigne un sprite du catalogue", () => {
    for (const b of BUILDINGS) expect((WORLD_ASSETS as readonly string[]).includes(b.sprite), b.sprite).toBe(true);
  });
});
