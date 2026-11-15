"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Compte à rebours affiché. Il ne fait PAS foi : le serveur refuse ce qui
 * arrive après la fin. On corrige seulement l'écart d'horloge du poste
 * avec l'heure serveur reçue au chargement.
 */
const ALERT_MINUTES = [10, 5] as const;
const ALERT_VISIBLE_MS = 20_000;
const END_PAUSE_MS = 2_500;

/**
 * Bandeaux « il reste 10 minutes » et « il reste 5 minutes », puis un message
 * clair à la fin avant le retour au rapport. Chaque bandeau n'apparaît qu'une
 * fois par session (mémorisé dans le navigateur), s'efface seul après 20 s et
 * se ferme au clic. `offsetMs` : écart entre l'horloge serveur et celle du poste.
 */
export function TimeAlerts({ deadlineIso, offsetMs }: { deadlineIso: string; offsetMs: number }) {
  const [shown, setShown] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () => {
      const left = Date.parse(deadlineIso) - (Date.now() + offsetMs);
      if (left <= 0) {
        setEnded(true);
        return;
      }
      for (const m of ALERT_MINUTES) {
        if (left > m * 60_000) continue;
        const key = `ta.${deadlineIso}.${m}`;
        let seen = false;
        try {
          seen = sessionStorage.getItem(key) !== null;
          if (!seen) sessionStorage.setItem(key, "1");
        } catch {
          /* stockage indisponible : le bandeau peut revenir, sans gravité */
        }
        // Seul le seuil le plus proche compte (5 min) ; un seuil déjà franchi au chargement n'est pas rejoué.
        if (!seen && left > (m - 1) * 60_000 - 1_000) {
          setShown(m);
          if (hideTimer.current) clearTimeout(hideTimer.current);
          hideTimer.current = setTimeout(() => setShown(null), ALERT_VISIBLE_MS);
        }
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => {
      clearInterval(id);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [deadlineIso, offsetMs]);

  if (ended) {
    return (
      <div className="px-timebanner" role="alert" data-level="0">
        <strong>Le temps est écoulé.</strong> Votre travail a été enregistré. Vous allez être redirigé vers le rapport de fin.
      </div>
    );
  }
  if (shown === null) return null;
  return (
    <div className="px-timebanner" role="status" data-level={shown}>
      <span>
        <strong>Il reste {shown} minutes.</strong> Votre travail est enregistré automatiquement ; ce que vous aurez rendu à la fin compte, même
        incomplet.
      </span>
      <button type="button" className="px-timebanner-close" onClick={() => setShown(null)} aria-label="Fermer ce rappel">
        ×
      </button>
    </div>
  );
}

export function Countdown({ deadlineIso, serverNowIso, pixel = false }: { deadlineIso: string; serverNowIso: string; pixel?: boolean }) {
  const router = useRouter();
  const [offset] = useState(() => Date.parse(serverNowIso) - Date.now());
  const [left, setLeft] = useState(() => Date.parse(deadlineIso) - (Date.now() + offset));

  useEffect(() => {
    const id = setInterval(() => {
      const ms = Date.parse(deadlineIso) - (Date.now() + offset);
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(id);
        // Courte pause : le message « temps écoulé » (TimeAlerts) reste lisible avant le rapport.
        setTimeout(() => router.refresh(), END_PAUSE_MS);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadlineIso, offset, router]);

  const total = Math.max(0, Math.ceil(left / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return (
    <>
    <TimeAlerts deadlineIso={deadlineIso} offsetMs={offset} />
    <span
      role="timer"
      aria-label={`Temps restant : ${mm} minutes ${ss} secondes`}
      data-urgent={total < 300}
      className={pixel ? "px-countdown" : `font-mono text-2xl tabular-nums ${total < 300 ? "text-red-600 dark:text-red-400" : ""}`}
    >
      {mm}:{ss}
    </span>
    </>
  );
}
