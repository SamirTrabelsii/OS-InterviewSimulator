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
    expect(isWalkable({ x: 64, y: 100 })).toBe(false); // dans le Savoir
    expect(isWalkable({ x: -5, y: 190 })).toBe(false);
    expect(isWalkable({ x: 200, y: 330 })).toBe(false); // sous le monde
    expect(isWalkable({ x: 186, y: 294 })).toBe(false); // pilier gauche du Portail
    expect(isWalkable({ x: 208, y: 292 })).toBe(true); // l'ouverture du Portail se franchit
    expect(isWalkable({ x: 112, y: 148 })).toBe(false); // pied d'un lampadaire
  });
});

describe("monde du hub : déplacement", () => {
  it("avance, glisse le long d'un obstacle et ne le traverse pas", () => {
    // Contre le mur des bâtiments (y = 136) : on monte, on glisse vers la droite.
    let p: Vec = { x: 40, y: 139 };
    for (let i = 0; i < 60; i++) p = stepPlayer(p, 1, -1, 16);
    expect(p.x).toBeGreaterThan(40);
    expect(isWalkable(p)).toBe(true);
    expect(p.y).toBeGreaterThanOrEqual(138);
  });
  it("un très long dt ne téléporte pas", () => {
    const p = stepPlayer({ x: 140, y: 200 }, 1, 0, 60_000);
    expect(p.x - 140).toBeLessThanOrEqual(6);
  });
  it("sans intention, ne bouge pas", () => {
    const p: Vec = { x: 140, y: 200 };
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
  it("de la rue jusqu'à l'ouverture du Portail, sans traverser un pilier", () => {
    const from = { x: 60, y: 200 };
    const path = findPath(from, TARGETS.portail)!;
    expect(path.length).toBeGreaterThan(0);
    for (const q of walk(from, path)) expect(isWalkable(q)).toBe(true);
  });
  it("de porte en porte, sans traverser les bâtiments", () => {
    const path = findPath(TARGETS.quiz, TARGETS.logique)!;
    for (const q of walk(TARGETS.quiz, path)) expect(isWalkable(q)).toBe(true);
  });
  it("ramène une destination non praticable à la zone la plus proche", () => {
    const path = findPath(START, { x: 64, y: 60 })!; // dans un bâtiment
    expect(path).not.toBeNull();
    expect(isWalkable(path[path.length - 1])).toBe(true);
  });
  it("est déterministe", () => {
    expect(findPath(START, TARGETS.portail)).toEqual(findPath(START, TARGETS.portail));
  });
});

describe("monde du hub : décor", () => {
  it("les accessoires tiennent dans le monde", () => {
    for (const p of PROPS) {
      expect(p.x, p.sprite).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w, p.sprite).toBeLessThanOrEqual(WORLD_W);
      expect(p.base, p.sprite).toBeLessThanOrEqual(WORLD_H);
    }
  });
  it("chaque accessoire plein bloque son pied, et aucun ne bloque une porte ni le Portail", () => {
    for (const p of PROPS.filter((q) => q.solid)) {
      expect(isWalkable({ x: p.x + p.w / 2, y: p.base - 3 }), `${p.sprite} ${p.x},${p.base}`).toBe(false);
    }
    for (const id of TARGET_IDS) expect(isWalkable(TARGETS[id]), id).toBe(true);
  });
  it("les quatre bâtiments reposent sur la façade (pied à y = 128) au-dessus de la zone praticable", () => {
    for (const b of BUILDINGS) expect(b.rect.y + b.rect.h).toBe(128);
    expect(isWalkable({ x: 64, y: 130 })).toBe(false);
  });
});
