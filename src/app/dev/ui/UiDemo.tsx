"use client";

import { useState } from "react";
import { GemIcon, Hud, PixelBar, PixelButton, PixelPanel, Sprite, type GemId, type Glow, type Tone } from "@/ui/pixel/components";
import { Drawer } from "@/ui/pixel/Drawer";
import { PixelFrame } from "@/ui/pixel/PixelFrame";
import { SPRITES, type SpriteName } from "@/ui/pixel/sprites";

const SWATCHES: Array<[string, string[]]> = [
  ["Fonds", ["bg-0", "bg-1", "bg-2", "surface-1", "surface-2", "surface-3"]],
  ["Traits", ["line-1", "line-2", "line-3"]],
  ["Textes", ["text", "text-dim", "text-mute"]],
  ["Cyan", ["cyan-l", "cyan", "cyan-d"]],
  ["Vert", ["green", "green-d"]],
  ["Magenta", ["magenta-l", "magenta", "magenta-d"]],
  ["Ambre", ["amber-l", "amber", "amber-d"]],
  ["Violet", ["violet", "violet-d"]],
  ["Alerte", ["danger"]],
];

const TONES: Tone[] = ["cyan", "green", "magenta", "amber", "violet"];
const ALL_GEMS: GemId[] = ["quiz", "sql", "algo", "logique"];

export function UiDemo() {
  const [reduced, setReduced] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [gems, setGems] = useState<GemId[]>(["quiz", "sql"]);
  const [progress, setProgress] = useState(0.6);

  return (
    <div data-motion={reduced ? "reduced" : undefined} style={{ padding: "calc(var(--px) * 8)", maxWidth: 1100, margin: "0 auto" }}>
      <h1 className="px-title" style={{ fontSize: "1.75rem", margin: "0 0 4px" }}>
        Composants pixel
      </h1>
      <p className="px-read" style={{ color: "var(--c-text-dim)", marginTop: 0 }}>
        Démonstration réservée au développement (404 en production). Partie 1 de l&apos;étape 9b.
      </p>

      <PixelPanel title="Réglages de la démo" tone="violet">
        <label className="px-read" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
          Animations réduites (simule la préférence système)
        </label>
      </PixelPanel>

      <PixelPanel title="HUD (chrono, gemmes, Bip)">
        <Hud
          timer="32:15"
          gems={gems}
          bip={{ onClick: () => setDrawer((o) => !o), expanded: drawer }}
        />
        <p style={{ margin: "12px 0 0" }}>
          {ALL_GEMS.map((g) => (
            <PixelButton
              key={g}
              variant="ghost"
              onClick={() => setGems((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]))}
            >
              Basculer {g}
            </PixelButton>
          ))}
        </p>
      </PixelPanel>

      <PixelPanel title="Palette">
        {SWATCHES.map(([name, keys]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0", flexWrap: "wrap" }}>
            <span className="px-panel-title" style={{ width: 90, margin: 0 }}>
              {name}
            </span>
            {keys.map((k) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  className="px-edge"
                  style={{ width: 28, height: 28, background: `var(--c-${k})`, display: "inline-block", margin: 1 }}
                />
                <code className="px-code" style={{ fontSize: 12 }}>
                  {k}
                </code>
              </span>
            ))}
          </div>
        ))}
      </PixelPanel>

      <PixelPanel title="Polices">
        <p className="px-title" style={{ fontSize: "1.25rem", margin: "0 0 8px" }}>
          Silkscreen : titres, HUD, boutons
        </p>
        <p style={{ fontFamily: "var(--f-ui)", fontSize: "1.125rem", margin: "0 0 8px" }}>
          Pixelify Sans : étiquettes et petits textes d&apos;interface
        </p>
        <p className="px-read" style={{ margin: "0 0 8px" }}>
          Atkinson Hyperlegible : les énoncés des épreuves. Une boutique de Maison Lumen affiche un stock négatif :
          retrouvez d&apos;où vient l&apos;écart avant minuit. 0O 1lI
        </p>
        <pre className="px-code" style={{ margin: 0 }}>
          {"SELECT sku, SUM(qty) AS stock\nFROM mouvements\nGROUP BY sku;  -- JetBrains Mono"}
        </pre>
      </PixelPanel>

      <PixelPanel title="Boutons (un seul principal par écran)">
        <PixelButton variant="primary">Valider</PixelButton>
        <PixelButton>Secondaire</PixelButton>
        <PixelButton variant="ghost">Discret</PixelButton>
        <PixelButton variant="primary" disabled>
          Désactivé
        </PixelButton>
        <PixelButton disabled>Désactivé</PixelButton>
      </PixelPanel>

      <PixelPanel title="Panneaux : tons et lumières par paliers">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TONES.map((t) =>
            ([0, 1, 2, 3] as Glow[]).map((g) => (
              <PixelPanel key={`${t}${g}`} tone={t} glow={g} className="" title={`${t} · ${g}`}>
                <span className="px-read" style={{ fontSize: "0.875rem" }}>
                  Lueur {g}
                </span>
              </PixelPanel>
            )),
          )}
        </div>
      </PixelPanel>

      <PixelPanel title="Barres">
        <PixelBar value={progress} label="Progression" />
        <PixelBar value={progress} tone="green" segments={20} label="Progression fine" />
        <PixelBar value={progress} tone="magenta" segments={5} label="Progression grossière" />
        <PixelBar value={progress} tone="amber" label="Progression ambre" />
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(progress * 100)}
          onChange={(e) => setProgress(Number(e.target.value) / 100)}
          aria-label="Valeur des barres"
        />
      </PixelPanel>

      <PixelPanel title="Sprites (remplaçables : public/sprites)">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          {(Object.keys(SPRITES) as SpriteName[]).map((n) => (
            <span key={n} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Sprite name={n} label={n} />
              <code className="px-code" style={{ fontSize: 12 }}>
                {n}
              </code>
            </span>
          ))}
          <span className="px-flicker" style={{ fontFamily: "var(--f-pixel)", color: "var(--c-magenta)" }}>
            NÉON
          </span>
          <GemIcon gem="algo" lit />
        </div>
      </PixelPanel>

      <PixelPanel title="Grille pixel : 320 × 200 agrandi en nombre entier">
        <PixelFrame label="Aperçu de la grille pixel">
          <div style={{ width: 320, height: 200, background: "#10132A" }}>
            <div style={{ position: "absolute", left: 96, top: 104, width: 128, height: 88, background: "#1B2040" }} />
            <div style={{ position: "absolute", left: 140, top: 60, width: 40, height: 20, background: "#FF4FD8", opacity: 0.9 }} />
            <div style={{ position: "absolute", left: 156, top: 130, width: 8, height: 8, background: "#3EF0FF" }} />
          </div>
        </PixelFrame>
        <p className="px-read" style={{ fontSize: "0.875rem", color: "var(--c-text-dim)" }}>
          Le facteur affiché dans l&apos;attribut data-scale du cadre est toujours entier.
        </p>
      </PixelPanel>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Bip">
        <p className="px-read">Le tiroir accueillera Bip et les indices. Échap ou X le ferme.</p>
        <PixelButton variant="secondary" onClick={() => setDrawer(false)}>
          Fermer
        </PixelButton>
      </Drawer>
    </div>
  );
}
