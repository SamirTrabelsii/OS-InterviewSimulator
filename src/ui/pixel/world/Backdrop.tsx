"use client";

import { useEffect, useRef, useState } from "react";
import { IH, IW, makeInterior, type InteriorId } from "./art/interiors";

/**
 * Décor d'intérieur fixe derrière une épreuve ou le Portail : une image de
 * 320 × 180 agrandie d'un facteur ENTIER qui couvre la fenêtre (rognée
 * au centre), sans animation ni interaction. Purement décoratif (aria-hidden) ;
 * le contenu se pose par-dessus sur des surfaces unies.
 */
export function Backdrop({ id }: { id: InteriorId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const measure = () => setScale(Math.max(1, Math.ceil(Math.max(window.innerWidth / IW, window.innerHeight / IH))));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const g = canvas.current?.getContext("2d");
    if (g) g.drawImage(makeInterior(id).toCanvas(), 0, 0);
  }, [id, scale]);

  return (
    <div className="px-backdrop" aria-hidden data-interior={id}>
      {scale > 0 && <canvas ref={canvas} width={IW} height={IH} style={{ width: IW * scale, height: IH * scale }} />}
    </div>
  );
}
