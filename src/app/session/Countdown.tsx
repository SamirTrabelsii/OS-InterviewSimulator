"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Compte à rebours affiché. Il ne fait PAS foi : le serveur refuse ce qui
 * arrive après la fin. On corrige seulement l'écart d'horloge du poste
 * avec l'heure serveur reçue au chargement.
 */
export function Countdown({ deadlineIso, serverNowIso }: { deadlineIso: string; serverNowIso: string }) {
  const router = useRouter();
  const [offset] = useState(() => Date.parse(serverNowIso) - Date.now());
  const [left, setLeft] = useState(() => Date.parse(deadlineIso) - (Date.now() + offset));

  useEffect(() => {
    const id = setInterval(() => {
      const ms = Date.parse(deadlineIso) - (Date.now() + offset);
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadlineIso, offset, router]);

  const total = Math.max(0, Math.ceil(left / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return (
    <span
      role="timer"
      aria-label={`Temps restant : ${mm} minutes ${ss} secondes`}
      className={`font-mono text-2xl tabular-nums ${total < 300 ? "text-red-600 dark:text-red-400" : ""}`}
    >
      {mm}:{ss}
    </span>
  );
}
