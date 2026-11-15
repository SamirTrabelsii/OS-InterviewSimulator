"use client";

import { useEffect, useRef, useState } from "react";
import { START, WORLD_H, WORLD_W } from "@/engine/hub/world";
import { integerScale } from "../scale";
import { createDistrict } from "./art/district";

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

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => setScale(Math.min(3, integerScale(el.clientWidth, window.innerHeight * 0.5, WORLD_W, WORLD_H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const g = canvas.current?.getContext("2d");
    if (!g) return;
    const set = new Set(doneKey ? doneKey.split(",") : []);
    const scene = createDistrict();
    scene.state.px = START.x;
    scene.state.py = START.y;
    scene.state.portal = portalOpen ? "open" : "closed";
    scene.render(g, 0, {
      rain: false,
      lights: true,
      reduced: true,
      details: false,
      bip: false,
      done: { quiz: set.has("quiz"), sql: set.has("sql"), algo: set.has("algo"), logique: set.has("logique") },
    });
  }, [doneKey, portalOpen, scale]);

  return (
    <div ref={host} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div className="px-world-stage px-edge px-tone-cyan" role="img" aria-label={label} style={{ width: WORLD_W * scale, height: WORLD_H * scale, cursor: "default" }}>
        <canvas ref={canvas} width={WORLD_W} height={WORLD_H} style={{ width: WORLD_W * scale, height: WORLD_H * scale, ["--wpx" as string]: `${scale}px` }} aria-hidden />
      </div>
    </div>
  );
}
