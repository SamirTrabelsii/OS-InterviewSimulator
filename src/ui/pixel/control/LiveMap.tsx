"use client";

import { useEffect, useRef, useState } from "react";
import type { MapSpot } from "@/engine/recruteur/live";
import { START, TARGETS, WORLD_H, WORLD_W } from "@/engine/hub/world";
import { PixelAvatar } from "./Avatar";
import { integerScale } from "../scale";
import { loadAtlas } from "../world/atlas";
import { buildStatic, drawFrame } from "../world/scene";

export type MapPin = { sessionId: string; name: string; spot: MapSpot | null };
type Gem = "quiz" | "sql" | "algo" | "logique";

/**
 * Mini-carte du quartier pour suivre une session en direct : le même décor
 * que le côté candidat (image fixe, aucune animation), avec une pastille par
 * candidat devant l'écran où il se trouve. Les gemmes affichées sont celles
 * que TOUS les candidats ont. Lecture seule.
 */
export function LiveMap({ pins, done, portalOpen, label }: { pins: MapPin[]; done: readonly Gem[]; portalOpen: boolean; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const doneKey = done.join(",");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => setScale(Math.min(2, integerScale(el.clientWidth, WORLD_H * 2)));
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
        player: { x: -64, y: -64 }, // pas de personnage : ce sont les pastilles qui montrent les candidats
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

  // Plusieurs candidats au même endroit : on les décale côte à côte.
  const placed = pins.filter((p) => p.spot !== null);
  const seen: Record<string, number> = {};

  return (
    <div ref={host} className="rc-map-host">
      <div className="px-world-stage px-edge px-tone-cyan rc-map" role="img" aria-label={label} style={{ width: WORLD_W * scale, height: WORLD_H * scale }}>
        <canvas ref={canvas} width={WORLD_W} height={WORLD_H} style={{ width: WORLD_W * scale, height: WORLD_H * scale }} aria-hidden />
        <div aria-hidden>
          {placed.map((p) => {
            const at = p.spot === "hub" ? START : TARGETS[p.spot as Exclude<MapSpot, "hub">];
            const k = seen[p.spot as string] ?? 0;
            seen[p.spot as string] = k + 1;
            return (
              <span key={p.sessionId} className="rc-pin" title={p.name} style={{ left: (at.x + (k - (placed.length > 1 ? 0.5 : 0)) * 12) * scale, top: at.y * scale }}>
                <PixelAvatar seed={p.sessionId} size={3} />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
