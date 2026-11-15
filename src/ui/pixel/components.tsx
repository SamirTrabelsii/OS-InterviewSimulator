import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { SPRITES, type SpriteName } from "./sprites";

export type Tone = "cyan" | "green" | "magenta" | "amber" | "violet";
export type Glow = 0 | 1 | 2 | 3;

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Sprite pixel : taille logique × --ps (entier), jamais lissé. */
export function Sprite({ name, label, className }: { name: SpriteName; label?: string; className?: string }) {
  const s = SPRITES[name];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pixel art : pas d'optimisation d'image
    <img
      src={s.src}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      width={s.w}
      height={s.h}
      style={{ width: `calc(${s.w} * var(--px))`, height: `calc(${s.h} * var(--px))` }}
      className={cx("px-sprite", className)}
      draggable={false}
    />
  );
}

/** Panneau à coins coupés, avec une lueur facultative (paliers 0 à 3). */
export function PixelPanel({
  title,
  tone = "cyan",
  glow = 0,
  className,
  children,
}: {
  title?: string;
  tone?: Tone;
  glow?: Glow;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx("px-panel px-edge", `px-tone-${tone}`, glow > 0 && `px-glow-${glow}`, className)}>
      {title && <h2 className="px-panel-title">{title}</h2>}
      {children}
    </section>
  );
}

/**
 * Bouton. Règle d'interface : UN seul `primary` par écran ; les autres
 * actions sont `secondary` ou `ghost`.
 */
export function PixelButton({
  variant = "secondary",
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      type={type}
      className={cx("px-btn", variant === "primary" && "px-btn-primary", variant === "ghost" && "px-btn-ghost", className)}
      {...rest}
    />
  );
}

/** Lien d'apparence bouton (navigation). Mêmes variantes que PixelButton. */
export function PixelLink({
  variant = "secondary",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <Link
      className={cx("px-btn", variant === "primary" && "px-btn-primary", variant === "ghost" && "px-btn-ghost", className)}
      style={{ textDecoration: "none" }}
      {...rest}
    />
  );
}

/** Barre à segments (progression). `value` est borné entre 0 et 1. */
export function PixelBar({
  value,
  segments = 10,
  tone = "cyan",
  label,
}: {
  value: number;
  segments?: number;
  tone?: Exclude<Tone, "violet">;
  label: string;
}) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const on = Math.round(v * segments);
  return (
    <div
      className={cx("px-bar px-edge", `px-bar-${tone}`)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className="px-bar-seg" data-on={i < on} />
      ))}
    </div>
  );
}

export type GemId = "quiz" | "sql" | "algo" | "logique";
const GEM_LABEL: Record<GemId, string> = { quiz: "Quiz", sql: "SQL", algo: "Algo", logique: "Logique" };

/** Une gemme, allumée (obtenue) ou éteinte. */
export function GemIcon({ gem, lit }: { gem: GemId; lit: boolean }) {
  return (
    <span className="px-gem" data-lit={lit}>
      <Sprite name={lit ? `gem-${gem}` : "gem-off"} label={`Gemme ${GEM_LABEL[gem]} : ${lit ? "obtenue" : "à obtenir"}`} />
    </span>
  );
}

const GEM_ORDER: GemId[] = ["quiz", "sql", "algo", "logique"];

/** Encart d'état : réussite, avertissement, erreur ou neutre. `role=status` (annoncé sans interrompre). */
export function PixelStatus({
  tone = "neutral",
  role,
  className,
  children,
}: {
  tone?: "neutral" | "ok" | "warn" | "bad";
  /** Par défaut : `alert` pour une erreur, `status` sinon. */
  role?: "alert" | "status";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role={role ?? (tone === "bad" ? "alert" : "status")} className={cx("px-status", className)} data-tone={tone}>
      {children}
    </div>
  );
}

/**
 * HUD réduit : chrono, 4 gemmes, et un seul bouton de tiroir (Aide, ou Bip
 * quand il sera activé). Rien d'autre.
 * `timer` est fourni par l'appelant (le vrai compte à rebours serveur) ;
 * `drawer` est absent quand il n'y a rien à ouvrir : le bouton n'apparaît pas.
 */
export function Hud({
  timer,
  gems,
  drawer,
}: {
  timer: ReactNode;
  gems: ReadonlyArray<GemId>;
  drawer?: { label: string; icon?: SpriteName; onClick: () => void; expanded: boolean };
}) {
  return (
    <header className="px-hud px-panel px-edge px-tone-cyan">
      <div className="px-hud-time" aria-label="Temps restant">
        {timer}
      </div>
      <ul className="px-hud-gems" aria-label="Gemmes">
        {GEM_ORDER.map((g) => (
          <li key={g}>
            <GemIcon gem={g} lit={gems.includes(g)} />
          </li>
        ))}
      </ul>
      {drawer && (
        <PixelButton variant="secondary" onClick={drawer.onClick} aria-expanded={drawer.expanded} aria-controls="px-drawer">
          {drawer.icon && <Sprite name={drawer.icon} />}
          {drawer.label}
        </PixelButton>
      )}
    </header>
  );
}
