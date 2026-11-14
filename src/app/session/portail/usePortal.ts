"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { PortalView } from "@/engine/portal";

export type Link = "connexion" | "ok" | "coupee" | "remplace" | "retire" | "refuse";
export type Ack = { ok: boolean; reason?: string; message?: string; passed?: number; total?: number; solved?: boolean; retryAfterMs?: number };

const REASONS: Record<string, string> = {
  "lecture-seule": "Seul le pilote peut modifier le code.",
  "trop-tot": "Patientez quelques secondes avant de relancer.",
  "en-cours": "Une vérification est déjà en cours.",
  occupe: "Le serveur d'exécution est occupé, réessayez dans un instant.",
  invalide: "Ce code ne peut pas être vérifié.",
  ferme: "Le Portail n'est pas ouvert.",
  termine: "Le temps est écoulé.",
  "pilote-present": "Le pilote est toujours connecté.",
  "deja-demandee": "Une demande est déjà en cours.",
  epoque: "Les rôles viennent de changer.",
};
export const reasonText = (a: Ack) => a.message ?? REASONS[a.reason ?? ""] ?? "Action impossible pour le moment.";

/**
 * Connexion Socket.IO du candidat (cookie de session, même origine) ou de
 * l'observateur (jeton court renouvelé à chaque reconnexion).
 */
export function usePortal(observerSlotId?: string) {
  const [view, setView] = useState<PortalView | null>(null);
  const [link, setLink] = useState<Link>("connexion");
  const [liveCode, setLiveCode] = useState<string | null>(null);
  const socket = useRef<Socket | null>(null);
  // Écart d'horloge avec le serveur (le chrono ne fait foi que côté serveur).
  const offset = useRef(0);

  useEffect(() => {
    const s = io({
      transports: ["websocket"],
      ...(observerSlotId
        ? {
            auth: (cb: (data: object) => void) => {
              fetch(`/api/recruteur/creneaux/${observerSlotId}/observer-token`, { cache: "no-store" })
                .then((r) => r.json())
                .then((j: { token?: string }) => cb({ observer: j.token ?? "" }))
                .catch(() => cb({ observer: "" }));
            },
          }
        : {}),
    });
    socket.current = s;
    s.on("connect", () => setLink("ok"));
    s.on("disconnect", (reason) => setLink((l) => (l === "remplace" || l === "retire" ? l : reason === "io server disconnect" ? "refuse" : "coupee")));
    s.on("connect_error", () => setLink("coupee"));
    s.on("replaced", () => setLink("remplace"));
    s.on("retire", () => setLink("retire"));
    s.on("state", (v: PortalView) => {
      offset.current = Date.parse(v.serverNow) - Date.now();
      setView(v);
      setLiveCode(v.code ?? null);
    });
    s.on("code", (m: { code: string }) => setLiveCode(m.code));
    return () => {
      s.close();
      socket.current = null;
    };
  }, [observerSlotId]);

  const send = useCallback(
    (event: string, payload?: unknown) =>
      new Promise<Ack>((resolve) => {
        const s = socket.current;
        if (!s?.connected) return resolve({ ok: false, message: "Connexion perdue, reconnexion en cours…" });
        s.timeout(60_000).emit(event, payload, (err: Error | null, res: Ack) => resolve(err ? { ok: false, message: "Pas de réponse du serveur." } : res));
      }),
    [],
  );

  return { view, link, liveCode, send, offset };
}
