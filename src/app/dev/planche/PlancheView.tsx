"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BH, BW } from "@/ui/pixel/world/art/buildings";
import { createDistrict, type District, type Input } from "@/ui/pixel/world/art/district";
import { createLightLayer, drawRain, drawSplashes, flicker, type Light } from "@/ui/pixel/world/art/fx";
import { GEM_KINDS, getArt, BUILDING_IDS, type Dir } from "@/ui/pixel/world/art";
import { COLORS, PALETTE } from "@/ui/pixel/world/art/palette";
import type { Pix } from "@/ui/pixel/world/art/pix";
import type { PortalState } from "@/ui/pixel/world/art/portal";

type Draw = (ctx: CanvasRenderingContext2D, t: number, dt: number) => void;

/** Canvas à la résolution logique, agrandi d'un facteur ENTIER (jamais flou). */
function PCanvas({ w, h, zoom, draw, animate = false, reduced = false, label, style, focusable, onReady }: {
  w: number;
  h: number;
  zoom: number;
  draw: Draw;
  animate?: boolean;
  reduced?: boolean;
  label: string;
  style?: CSSProperties;
  focusable?: boolean;
  onReady?: (el: HTMLCanvasElement) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    onReady?.(cv);
    let raf = 0;
    let last = performance.now();
    let visible = true;
    const t0 = last;
    const frame = (now: number) => {
      const dt = now - last;
      last = now;
      if (visible) {
        ctx.clearRect(0, 0, w, h);
        drawRef.current(ctx, reduced ? 0 : (now - t0) / 1000, dt);
      }
      if (animate && !reduced) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver((e) => {
      visible = e[0]?.isIntersecting ?? true;
    });
    io.observe(cv);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [w, h, animate, reduced, onReady]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      tabIndex={focusable ? 0 : undefined}
      style={{ width: w * zoom, height: h * zoom, imageRendering: "pixelated", display: "block", background: "#0b0c18", ...style }}
    />
  );
}

const CHECKER: CSSProperties = {
  backgroundImage: "linear-gradient(45deg,#10132a 25%,transparent 25%,transparent 75%,#10132a 75%),linear-gradient(45deg,#10132a 25%,#0b0c18 25%,#0b0c18 75%,#10132a 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0,4px 4px",
};

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section style={{ margin: "0 0 40px" }}>
      <h2 style={{ fontFamily: "var(--f-pixel)", fontSize: 16, color: "#b08cff", margin: "0 0 4px", letterSpacing: 1 }}>{title}</h2>
      {note && <p style={{ margin: "0 0 14px", color: "#a7a3d1", fontFamily: "var(--f-read)", fontSize: 14, maxWidth: 820 }}>{note}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end" }}>{children}</div>
    </section>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <div style={{ outline: "2px solid #2a3060", ...CHECKER }}>{children}</div>
      <figcaption style={{ fontFamily: "var(--f-pixel)", fontSize: 10, color: "#a7a3d1" }}>{label}</figcaption>
    </figure>
  );
}

function PixCell({ pix, label, zoom, repeat }: { pix: Pix; label: string; zoom: number; repeat?: [number, number] }) {
  const [rx, ry] = repeat ?? [1, 1];
  return (
    <Cell label={`${label} · ${pix.w}×${pix.h}`}>
      <PCanvas
        w={pix.w * rx}
        h={pix.h * ry}
        zoom={zoom}
        label={label}
        draw={(ctx) => {
          for (let j = 0; j < ry; j++) for (let i = 0; i < rx; i++) ctx.drawImage(pix.toCanvas(), i * pix.w, j * pix.h);
        }}
      />
    </Cell>
  );
}

function AnimCell({ frames, label, zoom, fps, bg }: { frames: Pix[]; label: string; zoom: number; fps: number; bg?: string }) {
  const f0 = frames[0];
  return (
    <Cell label={`${label} · ${f0.w}×${f0.h} · ${frames.length} images`}>
      <PCanvas
        w={f0.w}
        h={f0.h}
        zoom={zoom}
        animate
        label={label}
        style={bg ? { background: bg } : undefined}
        draw={(ctx, t) => ctx.drawImage(frames[Math.floor(t * fps) % frames.length].toCanvas(), 0, 0)}
      />
    </Cell>
  );
}

const btn = (on: boolean): CSSProperties => ({
  fontFamily: "var(--f-pixel)",
  fontSize: 11,
  padding: "6px 10px",
  background: on ? "#4a2f94" : "#1f2447",
  color: "#e8e6ff",
  border: `2px solid ${on ? "#b08cff" : "#3a4170"}`,
  cursor: "pointer",
});

/** Petite scène de test : dalles + lumière(s) pour montrer un halo. */
function LightDemo({ lights, zoom, label, w = 64, h = 48, extra }: { lights: Light[]; zoom: number; label: string; w?: number; h?: number; extra?: (ctx: CanvasRenderingContext2D, t: number) => void }) {
  const art = useMemo(() => getArt(), []);
  const layer = useRef<ReturnType<typeof createLightLayer> | null>(null);
  return (
    <Cell label={label}>
      <PCanvas
        w={w}
        h={h}
        zoom={zoom}
        animate
        label={label}
        draw={(ctx, t) => {
          for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) ctx.drawImage(art.ground["pave-a"].toCanvas(), x, y);
          extra?.(ctx, t);
          layer.current ??= createLightLayer(w, h);
          const k = flicker(t, 3);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.drawImage(layer.current.render(lights.map((l) => ({ ...l, k: l.k * k }))), 0, 0);
          ctx.restore();
        }}
      />
    </Cell>
  );
}

const DIRS: [Dir, string][] = [["down", "face"], ["up", "dos"], ["left", "gauche"], ["right", "droite"]];

export function PlancheView() {
  const art = useMemo(() => getArt(), []);
  const [zoom, setZoom] = useState(3);
  const [dz, setDz] = useState(3);
  const [rain, setRain] = useState(true);
  const [lights, setLights] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [portal, setPortal] = useState<PortalState>("open");
  const district = useRef<District | null>(null);
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const k = keys.current;
    const map: Record<string, string> = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", a: "l", d: "r", w: "u", s: "d", q: "l", z: "u" };
    const dn = (e: KeyboardEvent) => {
      const m = map[e.key];
      if (!m) return;
      if ((e.target as HTMLElement | null)?.tagName === "BUTTON") return;
      k.add(m);
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const m = map[e.key];
      if (m) k.delete(m);
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const input = (): Input => ({
    dx: (keys.current.has("r") ? 1 : 0) - (keys.current.has("l") ? 1 : 0),
    dy: (keys.current.has("d") ? 1 : 0) - (keys.current.has("u") ? 1 : 0),
  });

  const groundOrder = ["asphalt-a", "asphalt-b", "asphalt-c", "road-dash", "crosswalk", "curb-s", "curb-n", "pave-a", "pave-b", "plaza-a", "plaza-b", "plaza-circuit", "manhole", "grate", "gutter", "gravel"];
  const propOrder = ["lamp", "bench", "vending-mg", "vending-cy", "plant", "crate", "crate-stack", "dumpster", "bin", "bollard", "hydrant", "cabinet", "neon-board"];
  const propNames: Record<string, string> = { lamp: "Lampadaire", bench: "Banc", "vending-mg": "Distributeur (magenta)", "vending-cy": "Distributeur (cyan)", plant: "Plante", crate: "Caisse", "crate-stack": "Caisses empilées", dumpster: "Benne", bin: "Poubelle", bollard: "Borne", hydrant: "Borne incendie", cabinet: "Armoire électrique", "neon-board": "Enseigne BIENVENUE" };
  const bNames = { savoir: "Savoir · le quiz", archives: "Archives · le SQL", calcul: "Calcul · l'algo", intuition: "Intuition · la logique" };

  return (
    <main style={{ padding: "28px 28px 80px", maxWidth: 1500, margin: "0 auto", color: "#e8e6ff" }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--f-pixel)", fontSize: 24, margin: "0 0 8px", color: "#3ef0ff" }}>Planche de sprites · le quartier du Portail</h1>
        <p style={{ margin: 0, fontFamily: "var(--f-read)", color: "#a7a3d1", maxWidth: 860, lineHeight: 1.5 }}>
          Étape 1 : tous les graphismes sont dessinés par code (aucune image importée), dans une palette fermée de 32 couleurs. Rien n&apos;est encore branché sur le hub. Page réservée au développement.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--f-pixel)", fontSize: 11, color: "#a7a3d1" }}>ZOOM PLANCHE</span>
          {[2, 3, 4].map((z) => (
            <button key={z} type="button" style={btn(zoom === z)} onClick={() => setZoom(z)}>
              {z}×
            </button>
          ))}
          <label style={{ fontFamily: "var(--f-read)", fontSize: 14, marginLeft: 16, display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
            Animations réduites (image fixe)
          </label>
        </div>
      </header>

      <Section title="1 · PALETTE (32 couleurs)" note="Bleus nuit et violets profonds pour les volumes, trois rampes néon (cyan, magenta, vert), l'ambre pour la chaleur humaine, deux teintes de peau. Les lumières, la pluie et les reflets sont ajoutés par-dessus à l'exécution.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(16, 56px)", gap: 4 }}>
          {COLORS.map((c) => (
            <div key={c} title={PALETTE[c]} style={{ width: 56 }}>
              <div style={{ height: 30, background: PALETTE[c], outline: "1px solid #3a4170" }} />
              <div style={{ fontFamily: "var(--f-code)", fontSize: 9, color: "#a7a3d1", marginTop: 2 }}>{c}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="2 · SOL, ROUTES, TROTTOIRS" note="Tuiles 16×16 qui se raccordent (chacune est montrée en 3×2 pour vérifier les jointures). Pavés en dalles à arête éclairée, bordures dont on voit la face, asphalte fissuré, place en damier avec une variante à circuit.">
        {groundOrder.map((n) => (
          <PixCell key={n} pix={art.ground[n]} label={n} zoom={zoom} repeat={n.startsWith("curb") ? [3, 1] : [3, 2]} />
        ))}
        <Cell label="flaques (sur asphalte) · reflets animés dans la scène">
          <PCanvas
            w={48}
            h={16}
            zoom={zoom}
            animate
            reduced={reduced}
            label="flaques"
            draw={(ctx, t) => {
              for (let i = 0; i < 3; i++) ctx.drawImage(art.ground["asphalt-b"].toCanvas(), i * 16, 0);
              ctx.drawImage(art.ground["puddle-a"].toCanvas(), 0, 0);
              ctx.drawImage(art.ground["puddle-b"].toCanvas(), 24, 0);
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.fillStyle = "#ff4fd8";
              ctx.globalAlpha = 0.34;
              for (const [ox, pix] of [[0, art.ground["puddle-a"]], [24, art.ground["puddle-b"]]] as const)
                for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (pix.get(x, y) && (y + Math.floor(t * 2.2) + (x >> 2) * 2) % 4 === 0 && (x + y) % 2 === 0) ctx.fillRect(ox + x, y, 1, 1);
              ctx.restore();
            }}
          />
        </Cell>
      </Section>

      <Section title="3 · MOBILIER URBAIN" note="Objets en 3/4 : dessus éclairé, face avant, arête. Contour sélectif (teinte sombre de la couleur voisine), pas de trait noir. Les lueurs des enseignes sont ajoutées par la scène.">
        {propOrder.map((n) => (
          <PixCell key={n} pix={art.props[n]} label={propNames[n]} zoom={zoom} />
        ))}
      </Section>

      <Section title="4 · LES QUATRE BÂTIMENTS" note="Vue 3/4 : on voit le toit et la façade. Un équipement de toit et un motif de façade par bâtiment : Savoir (coupole vitrée, fenêtres en arc pleines de livres), Archives (tiroirs, climatiseurs, base de données), Calcul (parabole, cheminées, ruban de code, engrenage), Intuition (observatoire, hublots, œil). L'enseigne grésille.">
        {BUILDING_IDS.map((id, i) => (
          <Cell key={id} label={`${bNames[id]} · ${BW}×${BH}`}>
            <PCanvas
              w={BW}
              h={BH}
              zoom={Math.min(zoom, 3)}
              animate
              reduced={reduced}
              label={bNames[id]}
              draw={(ctx, t) => ctx.drawImage((reduced || flicker(t, i + 1, i === 2 ? 1.6 : 1) > 0.5 ? art.buildings[id].on : art.buildings[id].off).toCanvas(), 0, 0)}
            />
          </Cell>
        ))}
      </Section>

      <Section title="5 · LE PORTAIL" note="64×88. Fermé : champ de scellement sombre, cadenas, 4 emplacements vides. En charge : trois gemmes posées, tourbillon réduit. Ouvert : les 4 gemmes allumées, tourbillon sur 6 images en boucle.">
        <AnimCell frames={art.portal.closed} label="fermé" zoom={zoom} fps={1.5} />
        <AnimCell frames={art.portal.charging} label="en charge" zoom={zoom} fps={6} />
        <AnimCell frames={art.portal.open} label="ouvert" zoom={zoom} fps={8} />
      </Section>

      <Section title="6 · LE CANDIDAT (16×24)" note="4 directions (le côté droit est le miroir du gauche). Par direction : respiration au repos en 2 images (les deux premières), marche en 4 images. Casque cyan, sweat magenta, écusson dans le dos.">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DIRS.map(([d, name]) => (
            <div key={d} style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
              <span style={{ width: 54, fontFamily: "var(--f-pixel)", fontSize: 10, color: "#a7a3d1" }}>{name}</span>
              {[...art.player[d].idle, ...art.player[d].walk].map((p, i) => (
                <div key={i} style={{ ...CHECKER, outline: i < 2 ? "1px solid #4a2f94" : "1px solid #2a3060" }}>
                  <PCanvas w={16} h={24} zoom={zoom + 1} label={`${name} image ${i + 1}`} draw={(ctx) => ctx.drawImage(p.toCanvas(), 0, 0)} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
          {DIRS.map(([d, name]) => (
            <AnimCell key={d} frames={art.player[d].walk} label={`marche ${name}`} zoom={zoom + 1} fps={8} />
          ))}
          {DIRS.slice(0, 2).map(([d, name]) => (
            <AnimCell key={d} frames={art.player[d].idle} label={`repos ${name}`} zoom={zoom + 1} fps={1.6} />
          ))}
        </div>
      </Section>

      <Section title="7 · GEMMES ET BIP" note="Les quatre gemmes (12×12) scintillent sur 4 images ; Bip (12×14) flotte, cligne et crache un peu de flamme cyan.">
        {GEM_KINDS.map((k) => (
          <AnimCell key={k} frames={art.gems[k]} label={`gemme ${k}`} zoom={zoom + 2} fps={4} />
        ))}
        <AnimCell frames={art.bip} label="Bip" zoom={zoom + 2} fps={5} />
      </Section>

      <Section title="8 · EFFETS DE LUMIÈRE ET D'AMBIANCE" note="Halos à 4 paliers tramés (pas de dégradé lisse), cône de lampadaire, pluie en deux profondeurs avec éclaboussures, vapeur d'égout, étincelles, néon qui grésille.">
        <LightDemo zoom={zoom} label="halo cyan" lights={[{ x: 32, y: 24, r: 26, color: "cyL", k: 0.7 }]} />
        <LightDemo zoom={zoom} label="halo magenta" lights={[{ x: 32, y: 24, r: 26, color: "mgL", k: 0.7 }]} />
        <LightDemo zoom={zoom} label="halo vert" lights={[{ x: 32, y: 24, r: 26, color: "grL", k: 0.7 }]} />
        <LightDemo zoom={zoom} label="halo ambre" lights={[{ x: 32, y: 24, r: 26, color: "amL", k: 0.7 }]} />
        <LightDemo
          zoom={zoom}
          label="lampadaire : tête, cône, flaque de lumière"
          w={64}
          h={64}
          lights={[
            { x: 44, y: 11, r: 12, ry: 10, color: "amL", k: 0.8 },
            { x: 42, y: 13, r: 40, ry: 34, color: "am", k: 0.3, cone: true },
            { x: 36, y: 56, r: 28, ry: 10, color: "am", k: 0.4 },
          ]}
          extra={(ctx) => ctx.drawImage(art.props["lamp"].toCanvas(), 28, 14)}
        />
        <Cell label="pluie + éclaboussures">
          <PCanvas
            w={96}
            h={64}
            zoom={zoom}
            animate
            reduced={reduced}
            label="pluie"
            draw={(ctx, t) => {
              for (let y = 0; y < 64; y += 16) for (let x = 0; x < 96; x += 16) ctx.drawImage(art.ground[(x / 16 + y / 16) % 2 ? "asphalt-b" : "asphalt-a"].toCanvas(), x, y);
              ctx.drawImage(art.ground["puddle-a"].toCanvas(), 40, 30);
              drawSplashes(ctx, t, { x: 4, y: 6, w: 88, h: 52 }, 12);
              drawRain(ctx, 96, 64, t, 0.6);
            }}
          />
        </Cell>
        <AnimCell frames={art.steam} label="vapeur d'égout" zoom={zoom + 1} fps={5} bg="#171b36" />
        <AnimCell frames={art.sparks} label="étincelles" zoom={zoom + 2} fps={6} bg="#171b36" />
        <Cell label="grésillement de l'enseigne (courbe d'intensité)">
          <PCanvas
            w={80}
            h={20}
            zoom={zoom}
            animate
            reduced={reduced}
            label="grésillement"
            draw={(ctx, t) => {
              const a = art.buildings.archives;
              ctx.drawImage(a.signOn.toCanvas(), 12, 3);
              for (let i = 0; i < 80; i++) {
                const v = flicker(t - (80 - i) / 14 / 4, 2, 1.6);
                ctx.fillStyle = v < 0.5 ? "#ff4fd8" : "#4dffa6";
                ctx.fillRect(i, 19 - Math.round(v * 3), 1, 1);
              }
            }}
          />
        </Cell>
      </Section>

      <section style={{ margin: "0 0 40px" }}>
        <h2 style={{ fontFamily: "var(--f-pixel)", fontSize: 16, color: "#b08cff", margin: "0 0 4px", letterSpacing: 1 }}>9 · UN QUARTIER ASSEMBLÉ</h2>
        <p style={{ margin: "0 0 12px", color: "#a7a3d1", fontFamily: "var(--f-read)", fontSize: 14, maxWidth: 900 }}>
          Les quatre bâtiments, une rue avec passage piéton, une place et le Portail, sous la pluie. Cliquez sur la scène puis déplacez le candidat avec les flèches (ou ZQSD / WASD) : Bip le suit.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--f-pixel)", fontSize: 11, color: "#a7a3d1" }}>ZOOM</span>
          {[2, 3].map((z) => (
            <button key={z} type="button" style={btn(dz === z)} onClick={() => setDz(z)}>
              {z}×
            </button>
          ))}
          <span style={{ width: 10 }} />
          <button type="button" style={btn(rain)} onClick={() => setRain((v) => !v)}>
            Pluie
          </button>
          <button type="button" style={btn(lights)} onClick={() => setLights((v) => !v)}>
            Lumières
          </button>
          <span style={{ width: 10 }} />
          <span style={{ fontFamily: "var(--f-pixel)", fontSize: 11, color: "#a7a3d1" }}>PORTAIL</span>
          {(["closed", "charging", "open"] as const).map((s) => (
            <button key={s} type="button" style={btn(portal === s)} onClick={() => setPortal(s)}>
              {s === "closed" ? "Fermé" : s === "charging" ? "En charge" : "Ouvert"}
            </button>
          ))}
        </div>
        <div style={{ overflowX: "auto", border: "2px solid #2a3060", display: "inline-block", maxWidth: "100%" }}>
          <PCanvas
            w={416}
            h={320}
            zoom={dz}
            animate
            reduced={reduced}
            focusable
            label="Le quartier du Portail assemblé : quatre bâtiments néon, une rue, une place, le Portail"
            draw={(ctx, t, dt) => {
              district.current ??= createDistrict();
              const d = district.current;
              d.state.portal = portal;
              d.update(dt, input());
              d.render(ctx, t, { rain, lights, reduced, details: true });
            }}
          />
        </div>
      </section>
    </main>
  );
}
