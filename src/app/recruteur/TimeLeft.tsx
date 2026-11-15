"use client";

import { useEffect, useState } from "react";
import { formatRemaining } from "@/engine/recruteur/dashboard";

/**
 * Temps restant d'une session en cours, à la minute (rien ne défile).
 * Informatif : le chrono serveur fait foi. Le premier rendu part de l'heure
 * serveur reçue (pas de décalage à l'hydratation), puis on corrige l'écart
 * d'horloge du poste.
 */
export function TimeLeft({ deadlineIso, serverNowIso }: { deadlineIso: string; serverNowIso: string }) {
  const deadline = Date.parse(deadlineIso);
  const [left, setLeft] = useState(deadline - Date.parse(serverNowIso));

  useEffect(() => {
    const offset = Date.parse(serverNowIso) - Date.now();
    const tick = () => setLeft(deadline - (Date.now() + offset));
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [deadline, serverNowIso]);

  return (
    <span className="rc-badge" data-tone={left < 5 * 60_000 ? "amber" : "green"}>
      <span className="rc-dot" aria-hidden />
      <span aria-live="off">{left <= 0 ? "temps écoulé" : `reste ${formatRemaining(left)}`}</span>
    </span>
  );
}
