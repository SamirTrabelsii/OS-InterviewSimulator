"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

  const waitSeconds = waitUntil > now ? Math.ceil((waitUntil - now) / 1000) : 0;
  return { submit, pending, result, message, waitSeconds };
}

/** Résultat de la dernière soumission : « X / Y » seulement. */
export function SubmissionStatus({ result, message, what }: { result: CodeResult | null; message: string | null; what: string }) {
  if (message) {
    return (
      <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
        {message}
      </p>
    );
  }
  if (!result) return null;
  return (
    <div
      role="status"
      className={`rounded-md px-4 py-3 text-sm ${
        result.ok ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
      }`}
    >
      <p className="font-medium">
        {what} : {result.passed} / {result.total}
        {result.ok ? " — gemme obtenue !" : ""}
      </p>
      {result.error && <p className="mt-1 font-mono text-xs">{result.error}</p>}
    </div>
  );
}
