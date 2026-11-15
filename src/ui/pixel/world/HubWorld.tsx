"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BUILDINGS,
  PLAYER_SPEED,
  PORTAL_RECT,
  START,
  TARGETS,
  WORLD_H,
  WORLD_W,
  facingOf,
  findPath,
  isWalkable,
  nearTarget,
  stepPlayer,
  type Facing,
  type TargetId,
  type Vec,
} from "@/engine/hub/world";
import { PixelButton } from "../components";
import { integerScale } from "../scale";
import { loadAtlas, type Atlas } from "./atlas";
import { buildStatic, drawFrame } from "./scene";

export interface HubStage {
  gem: "quiz" | "sql" | "algo" | "logique";
  /** Titre de l'épreuve (vient du contenu public du scénario). */
  title: string;
  done: boolean;
  /** Nature de l'épreuve (Quiz, SQL, Python, Logique), affichée sous le bâtiment. */
  subtitle?: string;
}

export interface HubWorldProps {
  stages: HubStage[];
  portal: { title: string; open: boolean; /** État affiché tant que le Portail est fermé (ex. « en attente de votre binôme »). */ hint?: string };
  /** Texte d'invite quand aucun bâtiment n'est proche (par défaut : « Marchez jusqu'à un bâtiment… »). */
  idleHint?: string;
  /** Par défaut : navigation vers /session/<épreuve>. */
  onEnter?: (id: TargetId) => void;
  /** Force les animations réduites (sinon : préférence du système). */
  reducedMotion?: boolean;
}

const SIGN: Record<string, string> = Object.fromEntries(BUILDINGS.map((b) => [b.gem, b.sign]));
const STORAGE_KEY = "hub.pos";

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const systemReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Walker {
  pos: Vec;
  facing: Facing;
  moving: boolean;
  path: Vec[];
  pending: TargetId | null;
}

const KEYS: Record<string, [number, number]> = {
  arrowleft: [-1, 0], q: [-1, 0], a: [-1, 0],
  arrowright: [1, 0], d: [1, 0],
  arrowup: [0, -1], z: [0, -1], w: [0, -1],
  arrowdown: [0, 1], s: [0, 1],
};

export function HubWorld({ stages, portal, idleHint, onEnter, reducedMotion }: HubWorldProps) {
  const router = useRouter();
  const sysReduced = useSyncExternalStore(subscribeMotion, systemReduced, () => false);
  const reduced = reducedMotion ?? sysReduced;

  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(2);
  const [near, setNear] = useState<TargetId | null>(null);
  // Entrée en cours : la page suivante met quelques secondes à charger, on le dit.
  const [entering, setEntering] = useState<string | null>(null);

  // Valeurs lues par la boucle d'animation (écrites uniquement dans des effets).
  const live = useRef({ stages, portal, reduced, onEnter, near: null as TargetId | null, scale: 2 });
  const walker = useRef<Walker>({ pos: START, facing: "down", moving: false, path: [], pending: null });
  const held = useRef(new Set<string>());
  // Touches relâchées : retirées après une image, pour qu'une pression brève compte.
  const released = useRef(new Set<string>());

  useEffect(() => {
    live.current = { ...live.current, stages, portal, reduced, onEnter, scale };
  }, [stages, portal, reduced, onEnter, scale]);

  const enter = useCallback(
    (id: TargetId) => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(walker.current.pos));
      } catch {
        /* stockage indisponible : on repartira du point de départ */
      }
      const L = live.current;
      setEntering(id === "portail" ? L.portal.title : (L.stages.find((s) => s.gem === id)?.title ?? ""));
      if (live.current.onEnter) live.current.onEnter(id);
      else router.push(id === "portail" ? "/session/portail" : `/session/${id}`);
    },
    [router],
  );

  const enterable = useCallback((id: TargetId) => {
    if (id === "portail") return true;
    return live.current.stages.some((s) => s.gem === id && !s.done);
  }, []);

  /** Marche vers un point ; `pending` : on entre à l'arrivée. En animations réduites : on s'y rend d'un coup. */
  const goTo = useCallback(
    (to: Vec, pending: TargetId | null) => {
      const w = walker.current;
      const path = findPath(w.pos, to);
      if (!path) return;
      if (live.current.reduced) {
        w.pos = path[path.length - 1];
        w.path = [];
        w.moving = false;
        if (pending) enter(pending);
        return;
      }
      w.path = path;
      w.pending = pending;
    },
    [enter],
  );

  const goToTarget = useCallback(
    (id: TargetId) => {
      if (enterable(id)) goTo(TARGETS[id], id);
    },
    [enterable, goTo],
  );

  // Échelle entière selon la place disponible.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const s = integerScale(el.clientWidth, window.innerHeight - 230);
      setScale(s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Boucle de rendu et de mouvement.
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Vec | null;
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && isWalkable(saved)) walker.current.pos = saved;
    } catch {
      /* position non restaurée */
    }

    void loadAtlas().then((atlas: Atlas) => {
      if (cancelled) return;
      const g = canvas.current?.getContext("2d");
      if (!g) return;
      const statics = buildStatic(atlas);
      let last = performance.now();
      let lastDraw = -Infinity;

      const tick = (now: number) => {
        const dt = now - last;
        last = now;
        const w = walker.current;
        const L = live.current;

        // Intention clavier.
        let vx = 0;
        let vy = 0;
        for (const k of held.current) {
          const d = KEYS[k];
          if (d) {
            vx += d[0];
            vy += d[1];
          }
        }
        vx = Math.sign(vx);
        vy = Math.sign(vy);
        for (const k of released.current) held.current.delete(k);
        released.current.clear();

        if (vx !== 0 || vy !== 0) {
          w.path = [];
          w.pending = null;
          w.pos = stepPlayer(w.pos, vx, vy, dt);
          w.facing = facingOf(vx, vy, w.facing);
          w.moving = true;
        } else if (w.path.length > 0) {
          const target = w.path[0];
          const dx = target.x - w.pos.x;
          const dy = target.y - w.pos.y;
          const dist = Math.hypot(dx, dy);
          const stepLen = (PLAYER_SPEED * Math.min(dt, 100)) / 1000;
          if (dist <= stepLen) {
            w.pos = target;
            w.path.shift();
          } else {
            w.pos = { x: w.pos.x + (dx / dist) * stepLen, y: w.pos.y + (dy / dist) * stepLen };
            w.facing = facingOf(dx, dy, w.facing);
          }
          w.moving = true;
          if (w.path.length === 0) {
            w.moving = false;
            const p = w.pending;
            w.pending = null;
            if (p) enter(p);
          }
        } else {
          w.moving = false;
        }

        // Cible proche (invite « Entrer »).
        const n = nearTarget(w.pos);
        const nn = n && enterable(n) ? n : null;
        if (nn !== L.near) {
          L.near = nn;
          setNear(nn);
        }

        // Au repos, les animations avancent par paliers de 90 ms ou plus : 10 images/s suffisent.
        if (!w.moving && now - lastDraw < 100) {
          raf = requestAnimationFrame(tick);
          return;
        }
        lastDraw = now;

        const done = { quiz: false, sql: false, algo: false, logique: false };
        for (const s of L.stages) done[s.gem] = s.done;
        drawFrame(g, atlas, statics, {
          t: now,
          reduced: L.reduced,
          player: w.pos,
          facing: w.facing,
          moving: w.moving,
          done,
          portalOpen: L.portal.open,
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [enter, enterable]);

  // Clavier : flèches / ZQSD / WASD pour marcher, Entrée pour entrer.
  useEffect(() => {
    const interactive = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.closest("button, a, input, textarea, select, [contenteditable]") !== null);
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k in KEYS && !(interactive(e.target) && e.target instanceof HTMLElement && e.target.closest("input, textarea, select"))) {
        held.current.add(k);
        e.preventDefault();
        return;
      }
      if ((k === "enter" || k === " " || k === "e") && !interactive(e.target)) {
        const n = live.current.near;
        if (n) {
          e.preventDefault();
          goToTarget(n);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (held.current.has(k)) released.current.add(k);
    };
    const blur = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [goToTarget]);

  const onStagePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = stage.current?.getBoundingClientRect();
    if (!r) return;
    goTo({ x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }, null);
  };

  const nearStage = near && near !== "portail" ? stages.find((s) => s.gem === near) : null;
  const nearName = near === "portail" ? portal.title : (nearStage?.title ?? "");
  const nearSign = near === "portail" ? "PORTAIL" : near ? SIGN[near] : "";

  return (
    <div ref={host} className="px-world">
      <div
        ref={stage}
        className="px-world-stage px-edge px-tone-cyan"
        style={{ width: WORLD_W * scale, height: WORLD_H * scale, ["--wpx" as string]: `${scale}px` }}
        data-scale={scale}
        onPointerDown={onStagePointerDown}
      >
        <canvas
          ref={canvas}
          width={WORLD_W}
          height={WORLD_H}
          style={{ width: WORLD_W * scale, height: WORLD_H * scale }}
          aria-hidden
        />
        {BUILDINGS.map((b) => {
          const st = stages.find((s) => s.gem === b.gem);
          const done = st?.done ?? false;
          const box = { left: b.rect.x * scale, top: b.rect.y * scale, width: b.rect.w * scale, height: b.rect.h * scale };
          return (
            <div key={b.gem}>
              <span
                className={`px-sign px-tone-${b.tone} ${done || reduced ? "" : "px-flicker"}`}
                data-done={done}
                style={{ left: (b.rect.x + 4) * scale, top: (b.rect.y + 8) * scale, width: 56 * scale, height: 9 * scale }}
                aria-hidden
              >
                {b.sign}
              </span>
              {st?.subtitle && (
                <span
                  className="px-bldg-cap"
                  data-done={done}
                  style={{ left: b.rect.x * scale, top: (b.rect.y + b.rect.h) * scale, width: b.rect.w * scale }}
                  aria-hidden
                >
                  {st.subtitle}
                </span>
              )}
              {done ? (
                <div className="px-hit" style={{ ...box, pointerEvents: "none" }} role="img" aria-label={`${b.sign} : ${st?.title}, gemme obtenue`} />
              ) : (
                <button
                  type="button"
                  className="px-hit"
                  style={box}
                  onClick={() => goToTarget(b.gem)}
                  aria-label={`Entrer : ${b.sign}, ${st?.title ?? ""}`}
                />
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="px-hit"
          style={{ left: PORTAL_RECT.x * scale, top: PORTAL_RECT.y * scale, width: PORTAL_RECT.w * scale, height: PORTAL_RECT.h * scale }}
          onClick={() => goToTarget("portail")}
          aria-label={`${portal.title} : ${portal.open ? "ouvert" : (portal.hint ?? "pas encore ouvert")}`}
        />
      </div>

      <div className="px-world-prompt" aria-live="polite">
        {entering !== null ? (
          <span className="px-read px-world-hint" role="status">
            Entrée : {entering}… (quelques secondes)
          </span>
        ) : near ? (
          <>
            <PixelButton variant="primary" onClick={() => goToTarget(near)}>
              Entrer · {nearSign}
            </PixelButton>
            <span className="px-read px-world-name">{nearName}</span>
          </>
        ) : (
          <span className="px-read px-world-hint">{idleHint ?? "Marchez jusqu'à un bâtiment, ou cliquez dessus."}</span>
        )}
      </div>
      <p className="px-world-keys">Flèches, ZQSD ou WASD pour marcher · Entrée pour entrer · ou cliquez sur la carte</p>
    </div>
  );
}
