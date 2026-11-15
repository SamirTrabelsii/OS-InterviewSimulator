// Suivi en direct : où se trouve un candidat dans le quartier. Pur : on
// réutilise la reconstruction du replay (stateAt), sans la dupliquer.
import { stateAt, type ReplayEvent } from "@/engine/replay";

export type MapSpot = "hub" | "quiz" | "sql" | "algo" | "logique" | "portail";

/** Types d'événements utiles pour situer un candidat (évite de charger tout le journal). */
export const STAGE_EVENT_TYPES = ["stage.enter", "stage.leave"] as const;

/**
 * Lieu du candidat sur la mini-carte, d'après l'écran affiché. L'accueil et
 * le hub sont la place ; une épreuve est son bâtiment ; le Portail est le
 * Portail. Écran inconnu ou session finie : null (pas de pastille).
 */
export function spotOf(events: readonly ReplayEvent[], sessionStatus: string): MapSpot | null {
  if (sessionStatus !== "en_cours") return null;
  const stage = stateAt(events, Number.MAX_SAFE_INTEGER).stage;
  switch (stage) {
    case "quiz":
    case "sql":
    case "algo":
    case "logique":
    case "portail":
      return stage;
    case "accueil":
    case "hub":
      return "hub";
    default:
      return null;
  }
}
