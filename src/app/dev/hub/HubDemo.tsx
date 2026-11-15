"use client";

import { useState } from "react";
import { PixelButton, PixelPanel } from "@/ui/pixel/components";
import { HubWorld, type HubStage } from "@/ui/pixel/world/HubWorld";

const TITLES: Record<HubStage["gem"], string> = {
  quiz: "Le quiz du magasin",
  sql: "La requête des stocks",
  algo: "L'algorithme de réassort",
  logique: "L'énigme de la réserve",
};
const ORDER: HubStage["gem"][] = ["quiz", "sql", "algo", "logique"];

export function HubDemo() {
  const [done, setDone] = useState<HubStage["gem"][]>(["sql"]);
  const [open, setOpen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [last, setLast] = useState("(rien)");

  const stages: HubStage[] = ORDER.map((gem) => ({ gem, title: TITLES[gem], done: done.includes(gem) }));

  return (
    <div style={{ padding: "calc(var(--px) * 6)", maxWidth: 1400, margin: "0 auto" }}>
      <HubWorld
        stages={stages}
        portal={{ title: "Le Portail", open }}
        reducedMotion={reduced}
        onEnter={(id) => setLast(id)}
      />
      <PixelPanel title="Démo du monde (dev)" tone="violet">
        <p className="px-read" style={{ margin: "0 0 8px", fontSize: "0.9375rem" }}>
          Dernière entrée : <code className="px-code">{last}</code>
        </p>
        {ORDER.map((g) => (
          <PixelButton
            key={g}
            variant="ghost"
            onClick={() => setDone((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]))}
          >
            {done.includes(g) ? "Retirer" : "Obtenir"} {g}
          </PixelButton>
        ))}
        <PixelButton variant="ghost" onClick={() => setOpen((o) => !o)}>
          Portail : {open ? "fermer" : "ouvrir"}
        </PixelButton>
        <label className="px-read" style={{ display: "inline-flex", gap: 8, alignItems: "center", marginLeft: 12 }}>
          <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
          Animations réduites
        </label>
      </PixelPanel>
    </div>
  );
}
