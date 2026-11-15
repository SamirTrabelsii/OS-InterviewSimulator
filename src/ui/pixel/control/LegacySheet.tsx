import type { ReactNode } from "react";

/**
 * Transitoire : enveloppe les pages recruteur pas encore refaites pour
 * qu'elles gardent leur apparence d'origine dans le nouvel en-tête.
 * À retirer page par page (5c, 5d).
 */
export function LegacySheet({ children }: { children: ReactNode }) {
  return <div className="rc-legacy">{children}</div>;
}
