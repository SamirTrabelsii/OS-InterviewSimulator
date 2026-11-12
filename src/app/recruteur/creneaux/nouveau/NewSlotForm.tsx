"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createSlotAction, type CreateSlotState } from "../../actions";
import { CopyLink } from "../../CopyLink";

const input = "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export function NewSlotForm({ scenarios }: { scenarios: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<CreateSlotState, FormData>(createSlotAction, { status: "idle" });
  const [mode, setMode] = useState<"solo" | "binome">("binome");
  const [localDate, setLocalDate] = useState("");
  // Champs contrôlés : React vide un formulaire après chaque action, on
  // garde donc les valeurs saisies en cas d'erreur de validation.
  const [names, setNames] = useState(["", ""]);
  const setName = (i: number, v: string) => setNames((n) => n.map((x, j) => (j === i ? v : x)));

  if (state.status === "ok") {
    return (
      <section className="space-y-4">
        <p className="rounded-md bg-green-50 px-3 py-2 text-green-800 dark:bg-green-950 dark:text-green-200">
          Créneau créé. Envoyez à chaque candidat son lien personnel. Ces liens ne seront plus affichés : en cas de
          perte, générez-en un nouveau depuis la liste.
        </p>
        <ul className="space-y-2">
          {state.links.map((l) => (
            <li key={l.url} className="space-y-1">
              <div className="font-medium">{l.candidateName}</div>
              <CopyLink url={l.url} />
            </li>
          ))}
        </ul>
        <Link href="/recruteur" className="inline-block underline">
          Retour aux créneaux
        </Link>
      </section>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Scénario</span>
        <select name="scenario" className={input} required>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Date et heure de début</span>
        <input type="datetime-local" required value={localDate} onChange={(e) => setLocalDate(e.target.value)} className={input} />
        {/* Converti en ISO (UTC) dans le navigateur : le serveur ne devine pas le fuseau. */}
        <input type="hidden" name="scheduledAt" value={localDate ? new Date(localDate).toISOString() : ""} />
      </label>

      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Format</legend>
        <div className="flex gap-4">
          {(["binome", "solo"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
              {m === "binome" ? "Binôme (2 candidats)" : "Solo"}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Candidat 1</span>
        <input name="candidate" required placeholder="Prénom Nom" value={names[0]} onChange={(e) => setName(0, e.target.value)} className={input} />
      </label>
      {mode === "binome" && (
        <label className="block space-y-1">
          <span className="text-sm font-medium">Candidat 2</span>
          <input name="candidate" required placeholder="Prénom Nom" value={names[1]} onChange={(e) => setName(1, e.target.value)} className={input} />
        </label>
      )}

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}

      <button
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Création…" : "Créer le créneau"}
      </button>
    </form>
  );
}
