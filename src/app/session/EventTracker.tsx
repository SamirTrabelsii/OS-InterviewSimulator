"use client";

import { useEffect } from "react";

type ClientEvent = { type: string; clientTs: number; payload?: Record<string, unknown> };

const queue: ClientEvent[] = [];

/** Ajoute un événement à envoyer au prochain lot (utilisable par les épreuves). */
export function trackEvent(type: string, payload: Record<string, unknown> = {}) {
  queue.push({ type, clientTs: Date.now(), payload });
}

function flush(useBeacon = false) {
  if (queue.length === 0) return;
  const batch = queue.splice(0, 50);
  const body = JSON.stringify(batch);
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/session/events", new Blob([body], { type: "application/json" }));
    return;
  }
  fetch("/api/session/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
    () => queue.unshift(...batch), // réessai au prochain envoi
  );
}

/**
 * Journalise l'arrivée sur un écran et les pertes de focus (changement
 * d'onglet). Jamais bloquant : c'est une information pour le replay.
 */
export function EventTracker({ stage }: { stage: string }) {
  useEffect(() => {
    trackEvent("stage.enter", { stage });
    const onVisibility = () => trackEvent(document.hidden ? "focus.lost" : "focus.gained", { stage });
    const onHide = () => flush(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    const id = setInterval(() => flush(), 3000);
    return () => {
      trackEvent("stage.leave", { stage });
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      clearInterval(id);
      flush();
    };
  }, [stage]);
  return null;
}
