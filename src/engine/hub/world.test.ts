import { describe, expect, it } from "vitest";
import {
  BUILDINGS,
  PROPS,
  START,
  TARGETS,
  TARGET_IDS,
  WORLD_H,
  WORLD_W,
  facingOf,
  findPath,
  isWalkable,
  nearTarget,
  stepPlayer,
  type Vec,
} from "./world";

function walk(p: Vec, path: Vec[]): Vec[] {
  // Rejoue un chemin segment par segment en vérifiant chaque pas.
  const pts = [p, ...path];
  const out: Vec[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const n = Math.ceil(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y));
    for (let k = 0; k <= n; k++) {
      out.push({ x: pts[i].x + ((pts[i + 1].x - pts[i].x) * k) / Math.max(1, n), y: pts[i].y + ((pts[i + 1].y - pts[i].y) * k) / Math.max(1, n) });
    }
  }
  return out;
}

describe("monde du hub : géométrie", () => {
  it("le départ et chaque point d'entrée sont praticables", () => {
    expect(isWalkable(START)).toBe(true);
    for (const id of TARGET_IDS) expect(isWalkable(TARGETS[id]), id).toBe(true);
  });
  it("les bâtiments tiennent dans le monde, sans se chevaucher", () => {
    for (const b of BUILDINGS) {
      expect(b.rect.x).toBeGreaterThanOrEqual(0);
      expect(b.rect.x + b.rect.w).toBeLessThanOrEqual(WORLD_W);
      expect(b.rect.y + b.rect.h).toBeLessThanOrEqual(WORLD_H);
    }
    for (let i = 1; i < BUILDINGS.length; i++) {
      expect(BUILDINGS[i].rect.x).toBeGreaterThanOrEqual(BUILDINGS[i - 1].rect.x + BUILDINGS[i - 1].rect.w);
    }
  });
  it("on ne marche ni dans un bâtiment, ni hors du monde, ni dans le Portail", () => {
    expect(isWalkable({ x: 44, y: 60 })).toBe(false); // dans le Savoir
    expect(isWalkable({ x: -5, y: 90 })).toBe(false);
    expect(isWalkable({ x: 160, y: 205 })).toBe(false);
    expect(isWalkable({ x: 160, y: 158 })).toBe(false); // base du Portail
    expect(isWalkable({ x: 20, y: 150 })).toBe(false); // hors de la place
  });
});

describe("monde du hub : déplacement", () => {
  it("avance, glisse le long d'un obstacle et ne le traverse pas", () => {
    // Contre le mur des bâtiments (y = 80) : on monte, on glisse vers la droite.
    let p: Vec = { x: 40, y: 83 };
    for (let i = 0; i < 60; i++) p = stepPlayer(p, 1, -1, 16);
    expect(p.x).toBeGreaterThan(40);
    expect(isWalkable(p)).toBe(true);
    expect(p.y).toBeGreaterThanOrEqual(82);
  });
  it("un très long dt ne téléporte pas", () => {
    const p = stepPlayer({ x: 100, y: 95 }, 1, 0, 60_000);
    expect(p.x - 100).toBeLessThanOrEqual(6);
  });
  it("sans intention, ne bouge pas", () => {
    const p: Vec = { x: 100, y: 95 };
    expect(stepPlayer(p, 0, 0, 16)).toBe(p);
  });
  it("la direction suit l'axe dominant", () => {
    expect(facingOf(1, 0.2, "down")).toBe("right");
    expect(facingOf(-1, 0, "down")).toBe("left");
    expect(facingOf(0, -1, "left")).toBe("up");
    expect(facingOf(0, 0, "up")).toBe("up");
  });
});

describe("monde du hub : proximité et chemins", () => {
  it("détecte la porte la plus proche", () => {
    expect(nearTarget(TARGETS.algo)).toBe("algo");
    expect(nearTarget({ x: TARGETS.sql.x + 5, y: TARGETS.sql.y })).toBe("sql");
    expect(nearTarget(START)).toBeNull();
  });
  it("trouve un chemin libre de départ à chaque cible", () => {
    for (const id of TARGET_IDS) {
      const path = findPath(START, TARGETS[id]);
      expect(path, id).not.toBeNull();
      for (const q of walk(START, path!)) expect(isWalkable(q), `${id} ${q.x},${q.y}`).toBe(true);
      const end = path![path!.length - 1];
      expect(Math.hypot(end.x - TARGETS[id].x, end.y - TARGETS[id].y)).toBeLessThan(1);
    }
  });
  it("contourne le Portail depuis le nord de la place vers sa face sud", () => {
    const path = findPath({ x: 160, y: 110 }, TARGETS.portail)!;
    expect(path.length).toBeGreaterThan(1);
    for (const q of walk({ x: 160, y: 110 }, path)) expect(isWalkable(q)).toBe(true);
  });
  it("de porte en porte, sans traverser les bâtiments", () => {
    const path = findPath(TARGETS.quiz, TARGETS.logique)!;
    for (const q of walk(TARGETS.quiz, path)) expect(isWalkable(q)).toBe(true);
  });
  it("ramène une destination non praticable à la zone la plus proche", () => {
    const path = findPath(START, { x: 44, y: 50 })!; // dans un bâtiment
    expect(path).not.toBeNull();
    expect(isWalkable(path[path.length - 1])).toBe(true);
  });
  it("est déterministe", () => {
    expect(findPath(START, TARGETS.portail)).toEqual(findPath(START, TARGETS.portail));
  });
});

describe("monde du hub : décor", () => {
  const SIZE: Record<string, [number, number]> = {
    "prop-crate": [12, 10],
    "prop-vending": [12, 18],
    "prop-bench": [24, 10],
    "prop-plant": [10, 14],
    "prop-dumpster": [20, 12],
  };
  it("les accessoires tiennent dans le monde", () => {
    for (const p of PROPS) {
      const [w, h] = SIZE[p.sprite];
      expect(p.x, p.sprite).toBeGreaterThanOrEqual(0);
      expect(p.y, p.sprite).toBeGreaterThanOrEqual(0);
      expect(p.x + w, p.sprite).toBeLessThanOrEqual(WORLD_W);
      expect(p.y + h, p.sprite).toBeLessThanOrEqual(WORLD_H);
    }
  });
  it("aucun accessoire ne recouvre une zone praticable (la rue, la place)", () => {
    for (const p of PROPS) {
      const [w, h] = SIZE[p.sprite];
      for (const [dx, dy] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w / 2, h / 2]]) {
        expect(isWalkable({ x: p.x + dx, y: p.y + dy }), `${p.sprite} ${p.x},${p.y}`).toBe(false);
      }
    }
  });
});
