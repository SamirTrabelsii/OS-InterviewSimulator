"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { integerScale, WORLD_H, WORLD_W } from "./scale";

/**
 * Cadre à résolution logique fixe (320 × 200 par défaut) agrandi par un
 * facteur ENTIER pour tenir dans son conteneur. Le monde du hub (partie 2)
 * s'y dessinera ; ici il sert de démonstration de la grille.
 * Les enfants se dessinent en pixels logiques (1 unité = 1 pixel d'écran).
 */
export function PixelFrame({
  width = WORLD_W,
  height = WORLD_H,
  children,
  label,
}: {
  width?: number;
  height?: number;
  children: ReactNode;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => setScale(integerScale(el.clientWidth, window.innerHeight * 0.7, width, height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [width, height]);

  return (
    <div ref={host} style={{ width: "100%" }}>
      <div
        className="px-frame px-edge"
        role="img"
        aria-label={label}
        data-scale={scale}
        style={{ width: width * scale, height: height * scale }}
      >
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0", imageRendering: "pixelated" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
