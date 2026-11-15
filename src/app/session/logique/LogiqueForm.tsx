"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PixelButton, PixelPanel, PixelStatus } from "@/ui/pixel/components";

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

  // « 4 chiffres » → on accepte quelques espaces de confort, pas davantage.
  const maxLen = (Number(answerFormat.match(/\d+/)?.[0]) || 4) * 2;
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
      router.refresh(); // reste sur la page : « Gemme obtenue » s'affiche
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
    >
      <PixelPanel tone="amber" title="Le cadenas">
        <label>
          <span className="px-field-label">Code du cadenas ({answerFormat})</span>
          <input
            className="px-field"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={maxLen}
          />
        </label>
        {message && (
          <PixelStatus tone="warn">
            <p>{message}</p>
          </PixelStatus>
        )}
        <div className="px-actions">
          <PixelButton type="submit" variant="primary" disabled={!wellFormed || waiting || pending}>
            {waiting ? `Réessayez dans ${Math.ceil((waitUntil - now) / 1000)} s` : pending ? "…" : "Essayer"}
          </PixelButton>
        </div>
      </PixelPanel>
    </form>
  );
}
