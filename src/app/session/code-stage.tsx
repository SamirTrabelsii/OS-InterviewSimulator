"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type MutableRefObject } from "react";
import { PixelStatus } from "@/ui/pixel/components";
import { trackEvent } from "./EventTracker";

/** Taille maximale d'un instantané (le journal refuse les événements > 16 Ko). */
const SNAPSHOT_MAX_CHARS = 15_000;
const SNAPSHOT_EVERY_MS = 5_000;

/**
 * Instantanés du code pour le replay : toutes les ~5 s, seulement si le
 * code a changé depuis le dernier instantané (et à la sortie de la page).
 */
export function useCodeSnapshots(stage: string, initial: string) {
  const code = useRef(initial);
  const last = useRef(initial);

  useEffect(() => {
    const snap = () => {
      if (code.current === last.current) return;
      last.current = code.current;
      trackEvent("code.snapshot", { stage, code: code.current.slice(0, SNAPSHOT_MAX_CHARS) });
    };
    const id = setInterval(snap, SNAPSHOT_EVERY_MS);
    return () => {
      clearInterval(id);
      snap();
    };
  }, [stage]);

  return code;
}

/** Identifie la session dans la clé du brouillon (échéance unique par candidat), fourni par le cadre d'épreuve. */
export const DraftScope = createContext("");

const DRAFT_SAVE_DELAY_MS = 800;

/**
 * Sauvegarde automatique du code dans ce navigateur : un rechargement, une
 * coupure ou un retour depuis le quartier ne font pas perdre le travail.
 * `initial` reste null le temps de lire le brouillon (l'éditeur attend).
 */
export function useDraft(stage: string, starter: string, codeRef: MutableRefObject<string>) {
  const scope = useContext(DraftScope);
  const key = `draft.${stage}.${scope}`;
  const [initial, setInitial] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let value = starter;
    try {
      value = localStorage.getItem(key) ?? starter;
    } catch {
      /* stockage indisponible : on repart du code de départ */
    }
    codeRef.current = value;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du brouillon côté navigateur uniquement
    setInitial(value);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, starter, codeRef]);

  const onChange = useCallback(
    (value: string) => {
      codeRef.current = value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          localStorage.setItem(key, value);
          setSavedAt(Date.now());
        } catch {
          /* quota ou navigation privée : tant pis, le replay garde le code */
        }
      }, DRAFT_SAVE_DELAY_MS);
    },
    [key, codeRef],
  );

  return { initial, onChange, savedAt };
}

/** Mention discrète sous l'éditeur : le brouillon est sauvegardé tout seul. */
export function DraftNote({ savedAt }: { savedAt: number | null }) {
  return (
    <p className="px-muted" style={{ margin: 0 }} aria-live="off">
      {savedAt
        ? `Brouillon enregistré à ${new Date(savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} — votre code est sauvegardé automatiquement.`
        : "Votre code est sauvegardé automatiquement dans ce navigateur."}
    </p>
  );
}

/** Zone réservée pendant la lecture du brouillon (évite un saut de mise en page). */
export function EditorPlaceholder({ height }: { height: number }) {
  return <div className="px-editor px-edge" style={{ height }} aria-busy="true" />;
}

/** Réponse du serveur à une soumission SQL ou Algo (voir CodeResponse). */
export type CodeResult = { ok: boolean; gem: boolean; passed: number; total: number; error?: string; retryAfterMs?: number };

/** Soumission au serveur avec délai entre deux essais (le serveur fait foi). */
export function useSubmission(url: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CodeResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (waitUntil <= now) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [waitUntil, now]);

  async function submit(body: unknown) {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as Partial<CodeResult> & { error?: string; retryAfterMs?: number };
      if (data.retryAfterMs) {
        setWaitUntil(Date.now() + data.retryAfterMs);
        setNow(Date.now());
      }
      if (res.ok) {
        setResult(data as CodeResult);
        if (data.gem) router.refresh();
      } else {
        setMessage(data.error ?? "Une erreur est survenue.");
      }
    } catch {
      setMessage("Connexion perdue, réessayez.");
    } finally {
      setPending(false);
    }
  }

  /** Efface l'ancien verdict dès que le code change (sinon une vieille erreur reste affichée). */
  const reset = useCallback(() => {
    setResult(null);
    setMessage(null);
  }, []);

  const waitSeconds = waitUntil > now ? Math.ceil((waitUntil - now) / 1000) : 0;
  return { submit, pending, result, message, waitSeconds, reset };
}

/** Résultat de la dernière soumission : « X / Y » seulement. */
export function SubmissionStatus({ result, message, what }: { result: CodeResult | null; message: string | null; what: string }) {
  const box = useRef<HTMLDivElement>(null);
  // Fenêtre étroite : le verdict est sous l'éditeur, on l'amène à l'écran.
  useEffect(() => {
    if (result || message) box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [result, message]);
  if (message) {
    return (
      <div ref={box}>
        <PixelStatus tone="warn">
          <p>{message}</p>
        </PixelStatus>
      </div>
    );
  }
  if (!result) return null;
  return (
    <div ref={box}>
    <PixelStatus tone={result.ok ? "ok" : "neutral"}>
      <p className="px-status-title">
        {what} : {result.passed} / {result.total}
        {result.ok ? " — gemme obtenue !" : ""}
      </p>
      {result.error &&
        (result.error.startsWith("Colonnes inattendues") ? (
          <p>{result.error}</p>
        ) : (
          <p>
            <code>{result.error}</code>
          </p>
        ))}
    </PixelStatus>
    </div>
  );
}
