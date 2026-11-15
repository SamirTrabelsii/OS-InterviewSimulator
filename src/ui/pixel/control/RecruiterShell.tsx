import type { ReactNode } from "react";
import { NightShell } from "../NightShell";
import "./control.css";

/**
 * Enveloppe de l'espace recruteur : mêmes jetons et polices que le côté
 * candidat, mais pixel d'échelle 1 (néons discrets) et textes en police
 * très lisible. Voir control.css.
 */
export function RecruiterShell({ children }: { children: ReactNode }) {
  return <NightShell className="theme-control px-fill">{children}</NightShell>;
}
