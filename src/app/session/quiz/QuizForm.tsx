"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trackEvent } from "../EventTracker";

type Question = { id: string; prompt: string; choices: { id: string; label: string }[] };

export function QuizForm({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const complete = questions.every((q) => answers[q.id]);

  async function submit() {
    if (!confirm("Valider vos réponses ? Une seule validation est possible.")) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/session/gemmes/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    if (res.ok) {
      router.push("/session");
      router.refresh();
      return;
    }
    setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Une erreur est survenue.");
    setPending(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-6"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Une seule validation possible : relisez-vous avant de valider.</p>
      {questions.map((q, i) => (
        <fieldset key={q.id} className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 font-medium">
            {i + 1}. {q.prompt}
          </legend>
          {q.choices.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <input
                type="radio"
                name={q.id}
                value={c.id}
                checked={answers[q.id] === c.id}
                onChange={() => {
                  setAnswers((a) => ({ ...a, [q.id]: c.id }));
                  trackEvent("answer.change", { stage: "quiz", question: q.id, choice: c.id });
                }}
                className="mt-1"
              />
              <span>{c.label}</span>
            </label>
          ))}
        </fieldset>
      ))}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        disabled={!complete || pending}
        className="rounded-md bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Validation…" : "Valider mes réponses"}
      </button>
    </form>
  );
}
