"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PixelBar, PixelButton, PixelPanel, PixelStatus } from "@/ui/pixel/components";
import { trackEvent } from "../EventTracker";

type Question = { id: string; prompt: string; choices: { id: string; label: string }[] };

/** Une question par écran ; un seul bouton principal (Suivant, puis Valider). */
export function QuizForm({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const q = questions[index];
  const last = index === questions.length - 1;
  const answered = Boolean(answers[q.id]);
  const complete = questions.every((x) => answers[x.id]);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/session/gemmes/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    if (res.ok) {
      // Reste sur la page : le cadre affiche « Gemme obtenue » (message uniforme à toutes les épreuves).
      router.refresh();
      return;
    }
    setConfirming(false);
    setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Une erreur est survenue.");
    setPending(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!last) setIndex((i) => i + 1);
        else if (complete) setConfirming(true);
      }}
      className="px-stack"
    >
      <PixelStatus tone="warn">
        <p className="px-status-title">Une seule tentative</p>
        <p>
          Vous pouvez revenir en arrière tant que vous n&apos;avez pas validé. Une fois le quiz validé, il est définitif : la gemme est acquise, quel que
          soit le résultat.
        </p>
      </PixelStatus>
      <p className="px-stepper-label" aria-live="polite">
        Question {index + 1} sur {questions.length}
      </p>
      <PixelBar value={(index + 1) / questions.length} segments={questions.length} label="Avancement du quiz" />
      <PixelPanel tone="cyan">
        <fieldset className="px-choices" key={q.id}>
          <legend className="px-read" style={{ fontWeight: 700, marginBottom: "0.75rem" }}>
            {q.prompt}
          </legend>
          {q.choices.map((c) => (
            <label key={c.id} className="px-choice">
              <input
                type="radio"
                name={q.id}
                value={c.id}
                checked={answers[q.id] === c.id}
                onChange={() => {
                  setAnswers((a) => ({ ...a, [q.id]: c.id }));
                  trackEvent("answer.change", { stage: "quiz", question: q.id, choice: c.id });
                }}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </fieldset>
      </PixelPanel>
      {error && <PixelStatus tone="bad">{error}</PixelStatus>}
      {confirming ? (
        <PixelPanel tone="amber" glow={1} title="Valider vos réponses ?">
          <p className="px-read" role="alert" style={{ marginTop: 0 }}>
            Vous ne pourrez plus les modifier ni refaire le quiz.
          </p>
          <div className="px-actions">
            <PixelButton variant="primary" onClick={() => void submit()} disabled={pending}>
              {pending ? "Validation…" : "Oui, valider définitivement"}
            </PixelButton>
            <PixelButton variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              Revoir mes réponses
            </PixelButton>
          </div>
        </PixelPanel>
      ) : (
      <div className="px-actions">
        {index > 0 && (
          <PixelButton variant="ghost" onClick={() => setIndex((i) => i - 1)} disabled={pending}>
            ← Précédente
          </PixelButton>
        )}
        <PixelButton type="submit" variant="primary" disabled={!answered || pending || (last && !complete)}>
          {last ? (pending ? "Validation…" : "Valider mes réponses") : "Suivante →"}
        </PixelButton>
      </div>
      )}
    </form>
  );
}
