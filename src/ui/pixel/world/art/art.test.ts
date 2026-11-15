import { describe, expect, it } from "vitest";
import { BH, BUILDING_IDS, BW } from "./buildings";
import { PACKED, COLORS } from "./palette";
import { getArt } from "./index";
import type { Pix } from "./pix";

const art = getArt();
const allPix = (): [string, Pix][] => {
  const out: [string, Pix][] = [];
  for (const [k, p] of Object.entries(art.ground)) out.push([`sol/${k}`, p]);
  for (const [k, p] of Object.entries(art.props)) out.push([`mobilier/${k}`, p]);
  for (const id of BUILDING_IDS) out.push([`bat/${id}/on`, art.buildings[id].on], [`bat/${id}/off`, art.buildings[id].off]);
  for (const [s, list] of Object.entries(art.portal)) list.forEach((p, i) => out.push([`portail/${s}/${i}`, p]));
  for (const [d, v] of Object.entries(art.player)) [...v.idle, ...v.walk].forEach((p, i) => out.push([`joueur/${d}/${i}`, p]));
  for (const [k, list] of Object.entries(art.gems)) list.forEach((p, i) => out.push([`gemme/${k}/${i}`, p]));
  art.bip.forEach((p, i) => out.push([`bip/${i}`, p]));
  art.steam.forEach((p, i) => out.push([`vapeur/${i}`, p]));
  art.sparks.forEach((p, i) => out.push([`etincelles/${i}`, p]));
  return out;
};

describe("planche de sprites du hub", () => {
  it("la palette compte 32 couleurs distinctes", () => {
    expect(COLORS).toHaveLength(32);
    expect(new Set(Object.values(PACKED)).size).toBe(32);
  });

  it("chaque sprite n'emploie que des couleurs de la palette", () => {
    const palette = new Set(Object.values(PACKED));
    for (const [name, p] of allPix()) for (const v of p.used()) expect(palette.has(v), `${name} : couleur hors palette`).toBe(true);
  });

  it("aucun sprite n'est vide", () => {
    for (const [name, p] of allPix()) expect(p.isEmpty(), name).toBe(false);
  });

  it("les tailles respectent le contrat", () => {
    for (const [k, p] of Object.entries(art.ground)) expect([p.w, p.h], k).toEqual([16, 16]);
    for (const id of BUILDING_IDS) {
      expect([art.buildings[id].on.w, art.buildings[id].on.h]).toEqual([BW, BH]);
      expect([art.buildings[id].off.w, art.buildings[id].off.h]).toEqual([BW, BH]);
    }
    for (const list of Object.values(art.portal)) for (const p of list) expect([p.w, p.h]).toEqual([64, 88]);
    for (const v of Object.values(art.player)) for (const p of [...v.idle, ...v.walk]) expect([p.w, p.h]).toEqual([16, 24]);
    for (const list of Object.values(art.gems)) for (const p of list) expect([p.w, p.h]).toEqual([12, 12]);
  });

  it("le personnage : 2 images de repos et 4 de marche distinctes dans chaque direction", () => {
    for (const [d, v] of Object.entries(art.player)) {
      expect(v.idle).toHaveLength(2);
      expect(v.walk).toHaveLength(4);
      expect(new Set(v.idle.map((p) => p.signature())).size, `${d} repos`).toBe(2);
      expect(new Set(v.walk.map((p) => p.signature())).size, `${d} marche`).toBe(4);
    }
    // les quatre directions se distinguent
    expect(new Set(Object.values(art.player).map((v) => v.walk[0].signature())).size).toBe(4);
  });

  it("l'enseigne allumée diffère de l'enseigne éteinte, et chaque bâtiment est unique", () => {
    const sigs = new Set<string>();
    for (const id of BUILDING_IDS) {
      expect(art.buildings[id].on.signature()).not.toBe(art.buildings[id].off.signature());
      sigs.add(art.buildings[id].on.signature());
    }
    expect(sigs.size).toBe(4);
  });

  it("le tourbillon du Portail boucle en 6 images, toutes différentes", () => {
    expect(new Set(art.portal.open.map((p) => p.signature())).size).toBe(6);
  });

  it("la génération est reproductible", () => {
    const a = allPix().map(([, p]) => p.signature());
    // régénération à froid : mêmes pixels
    const again = getArt();
    expect(again).toBe(art);
    expect(allPix().map(([, p]) => p.signature())).toEqual(a);
  });
});
