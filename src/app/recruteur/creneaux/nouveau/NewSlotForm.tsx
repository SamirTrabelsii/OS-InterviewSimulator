"use client";

import { useActionState, useState } from "react";
import { PixelButton, PixelLink, PixelPanel, PixelStatus } from "@/ui/pixel/components";
import "@/ui/pixel/control/form.css";
import { createSlotAction, type CreateSlotState } from "../../actions";
import { CopyLink } from "../../CopyLink";

export function NewSlotForm({ scenarios }: { scenarios: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<CreateSlotState, FormData>(createSlotAction, { status: "idle" });
  const [mode, setMode] = useState<"solo" | "binome">("binome");
  const [localDate, setLocalDate] = useState("");
  // Champs contrôlés : React vide un formulaire après chaque action, on
  // garde donc les valeurs saisies en cas d'erreur de validation.
  const [names, setNames] = useState(["", ""]);
  const [callUrl, setCallUrl] = useState("");
  const setName = (i: number, v: string) => setNames((n) => n.map((x, j) => (j === i ? v : x)));

  if (state.status === "ok") {
    return (
      <div className="fm-stack">
        <PixelStatus tone="ok">
          <p className="px-status-title">Mission créée.</p>
          <p>Envoyez à chaque candidat son lien personnel. Ces liens ne seront plus affichés : en cas de perte, générez-en un nouveau depuis la liste.</p>
        </PixelStatus>
        <PixelPanel title="Liens candidats" tone="green">
          <ul className="fm-links">
            {state.links.map((l) => (
              <li key={l.url}>
                <span className="fm-link-name">{l.candidateName}</span>
                <CopyLink url={l.url} />
              </li>
            ))}
          </ul>
        </PixelPanel>
        <PixelLink href="/recruteur" variant="primary" className="fm-self">
          Retour aux missions
        </PixelLink>
      </div>
    );
  }

  return (
    <form action={action}>
      <PixelPanel title="Paramètres de la mission" className="fm-panel">
        <label className="fm-field">
          <span className="rc-label">Scénario</span>
          <select name="scenario" className="rv-input" required>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="fm-field">
          <span className="rc-label">Date et heure de début</span>
          <input type="datetime-local" required value={localDate} onChange={(e) => setLocalDate(e.target.value)} className="rv-input" />
          {/* Converti en ISO (UTC) dans le navigateur : le serveur ne devine pas le fuseau. */}
          <input type="hidden" name="scheduledAt" value={localDate ? new Date(localDate).toISOString() : ""} />
        </label>

        <fieldset className="fm-field fm-fieldset">
          <legend className="rc-label">Format</legend>
          <div className="fm-choices">
            {(["binome", "solo"] as const).map((m) => (
              <label key={m} className="fm-choice" data-on={mode === m}>
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
                {m === "binome" ? "Binôme (2 candidats)" : "Solo"}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="fm-field">
          <span className="rc-label">Candidat 1</span>
          <input name="candidate" required placeholder="Prénom Nom" value={names[0]} onChange={(e) => setName(0, e.target.value)} className="rv-input" />
        </label>
        {mode === "binome" && (
          <label className="fm-field">
            <span className="rc-label">Candidat 2</span>
            <input name="candidate" required placeholder="Prénom Nom" value={names[1]} onChange={(e) => setName(1, e.target.value)} className="rv-input" />
          </label>
        )}

        {mode === "binome" && (
          <label className="fm-field">
            <span className="rc-label">Lien de l&apos;appel (Teams, Meet…) — facultatif</span>
            <input
              name="callUrl"
              type="url"
              inputMode="url"
              placeholder="https://teams.microsoft.com/…"
              value={callUrl}
              onChange={(e) => setCallUrl(e.target.value)}
              className="rv-input"
            />
            <span className="px-muted">Affiché aux candidats sur l&apos;accueil et dans le Portail, pour qu&apos;ils puissent se parler.</span>
          </label>
        )}

        {state.status === "error" && <PixelStatus tone="bad">{state.message}</PixelStatus>}

        <PixelButton type="submit" variant="primary" disabled={pending} className="fm-self">
          {pending ? "Création…" : "Créer la mission"}
        </PixelButton>
      </PixelPanel>
    </form>
  );
}
