"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LogiqueForm({ answerFormat, answerPattern }: { answerFormat: string; answerPattern: string }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (waitUntil <= now) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [waitUntil, now]);

  const wellFormed = new RegExp(answerPattern).test(answer.replace(/\s+/g, ""));
  const waiting = waitUntil > now;

  async function submit() {
    setPending(true);
    setMessage(null);
    const res = await fetch("/api/session/gemmes/logique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; retryAfterMs?: number };
    setPending(false);
    if (res.ok && body.ok) {
      router.push("/session");
      router.refresh();
      return;
    }
    if (body.retryAfterMs) {
      setWaitUntil(Date.now() + body.retryAfterMs);
      setNow(Date.now());
    }
    setMessage(res.ok ? "Le cadenas ne s'ouvre pas." : (body.error ?? "Une erreur est survenue."));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="space-y-1">
        <span className="block text-sm font-medium">Code du cadenas ({answerFormat})</span>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          className="w-40 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-center font-mono text-2xl tracking-[0.4em] dark:border-zinc-700"
        />
      </label>
      <button
        disabled={!wellFormed || waiting || pending}
        className="rounded-md bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {waiting ? `Patientez ${Math.ceil((waitUntil - now) / 1000)} s` : pending ? "…" : "Essayer"}
      </button>
      {message && (
        <p role="status" className="w-full text-sm text-zinc-700 dark:text-zinc-300">
          {message}
        </p>
      )}
    </form>
  );
}
