import { NightShell } from "@/ui/pixel/NightShell";

/** Écran d'attente des épreuves (même fond que l'épreuve, pas d'éclair blanc). */
export function StageLoading() {
  return (
    <NightShell>
      <div className="px-stage">
        <p className="px-muted" role="status">
          Chargement…
        </p>
      </div>
    </NightShell>
  );
}
