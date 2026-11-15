"use client";

import { useEffect, useRef, useState } from "react";
import { BUILDINGS, START, WORLD_H, WORLD_W } from "@/engine/hub/world";
import { integerScale } from "../scale";
import { loadAtlas } from "./atlas";
import { buildStatic, drawFrame } from "./scene";

/**
 * Vue fixe du quartier (accueil, rapport de fin) : une seule image, aucune
 * animation, aucune interaction. Réutilise le rendu du hub, donc les mêmes
 * graphismes remplaçables. `done` : gemmes obtenues (elles flottent, le
 * Portail les affiche) ; `portalOpen` : Portail ouvert.
 */
export function WorldPreview({
  done,
  portalOpen = false,
  label,
}: {
  done: ReadonlyArray<"quiz" | "sql" | "algo" | "logique">;
  portalOpen?: boolean;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const doneKey = done.join(",");
  const set = new Set<string>(done);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => setScale(Math.min(3, integerScale(el.clientWidth, window.innerHeight * 0.5)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAtlas().then((atlas) => {
      const g = canvas.current?.getContext("2d");
      if (cancelled || !g) return;
      const set = new Set(doneKey ? doneKey.split(",") : []);
      drawFrame(g, atlas, buildStatic(atlas), {
        t: 0,
        reduced: true,
        player: START,
        facing: "down",
        moving: false,
        done: { quiz: set.has("quiz"), sql: set.has("sql"), algo: set.has("algo"), logique: set.has("logique") },
        portalOpen,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [doneKey, portalOpen, scale]);

  return (
    <div ref={host} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div className="px-world-stage px-edge px-tone-cyan" role="img" aria-label={label} style={{ width: WORLD_W * scale, height: WORLD_H * scale, cursor: "default" }}>
        <canvas ref={canvas} width={WORLD_W} height={WORLD_H} style={{ width: WORLD_W * scale, height: WORLD_H * scale, ["--wpx" as string]: `${scale}px` }} aria-hidden />
        <div style={{ ["--wpx" as string]: `${scale}px` }} aria-hidden>
          {BUILDINGS.map((b) => (
            <span
              key={b.gem}
              className={`px-sign px-tone-${b.tone}`}
              data-done={set.has(b.gem)}
              style={{ left: (b.rect.x + 4) * scale, top: (b.rect.y + 8) * scale, width: 56 * scale, height: 9 * scale }}
            >
              {b.sign}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
