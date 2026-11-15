import type { ReactNode } from "react";
import { candidateState, effectiveSlotStatus, groupSlots, tally, type CandidateState } from "@/engine/recruteur/dashboard";
import { PixelLink, PixelPanel, PixelStatus, type Tone } from "@/ui/pixel/components";
import { PixelAvatar } from "@/ui/pixel/control/Avatar";
import { GemRow } from "@/ui/pixel/control/Gems";
import { DevOpenPortal } from "./DevOpenPortal";
import { LiveRefresh } from "./LiveRefresh";
import { LocalDate } from "./LocalDate";
import { RegenerateLink } from "./RegenerateLink";
import { TimeLeft } from "./TimeLeft";

export type DashboardSlot = {
  id: string;
  scenario: string;
  mode: "solo" | "binome";
  status: string;
  scheduledAt: Date;
  candidates: { sessionId: string; name: string; status: string; gems: string[]; deadline: Date | null }[];
};

const SLOT_STATUS: Record<string, string> = { planifie: "Planifiée", en_cours: "En cours", termine: "Terminée", annule: "Annulée" };

/** « Mission » = créneau : on l'explique en sous-titre, puis en info-bulle. */
function Mission({ children = "mission" }: { children?: ReactNode }) {
  return (
    <abbr className="rc-term" title="Mission = créneau d'entretien">
      {children}
    </abbr>
  );
}

function StateBadge({ state, deadline, nowIso }: { state: CandidateState; deadline: Date | null; nowIso: string }) {
  switch (state.kind) {
    case "a_noter":
      return (
        <span className="rc-badge" data-tone="amber" data-strong="true" title="Session terminée, pas encore notée par vous">
          À noter
        </span>
      );
    case "note":
      return (
        <span className="rc-badge" data-tone="mute">
          Noté
        </span>
      );
    case "en_cours":
      return deadline ? (
        <TimeLeft deadlineIso={deadline.toISOString()} serverNowIso={nowIso} />
      ) : (
        <span className="rc-badge" data-tone="green">
          <span className="rc-dot" aria-hidden />
          En cours
        </span>
      );
    case "attente":
      return (
        <span className="rc-badge" data-tone="cyan">
          En attente
        </span>
      );
    case "retire":
      return (
        <span className="rc-badge" data-tone="mute">
          Retiré (solo)
        </span>
      );
  }
}

function SlotCard({
  slot,
  title,
  evaluated,
  now,
  tone,
  devShortcuts,
}: {
  slot: DashboardSlot;
  title: string;
  evaluated: ReadonlySet<string>;
  now: Date;
  tone: Tone;
  devShortcuts: boolean;
}) {
  const nowIso = now.toISOString();
  const live = slot.status === "en_cours";
  return (
    <li>
      <PixelPanel tone={tone} glow={live ? 1 : 0} className="rc-slot">
        <div className="rc-slot-head">
          <div>
            <h3 className="rc-slot-title">{title}</h3>
            <p className="rc-slot-meta">
              <LocalDate iso={slot.scheduledAt.toISOString()} /> · {slot.mode === "solo" ? "Solo" : "Binôme"} · {SLOT_STATUS[slot.status] ?? slot.status}
            </p>
          </div>
          {live && (
            <PixelLink href={`/recruteur/creneaux/${slot.id}/portail`} className="px-btn-sm">
              Observer le Portail
            </PixelLink>
          )}
        </div>

        <ul className="rc-cands">
          {slot.candidates.map((c) => {
            const state = candidateState({ status: c.status, deadline: c.deadline, evaluatedByMe: evaluated.has(c.sessionId) }, now);
            return (
              <li key={c.sessionId} className="rc-cand">
                <PixelAvatar seed={c.sessionId} />
                <span className="rc-cand-name">{c.name}</span>
                <StateBadge state={state} deadline={c.deadline} nowIso={nowIso} />
                <GemRow gems={c.gems} />
                <span className="rc-cand-act">
                  {c.status === "en_attente" ? (
                    <RegenerateLink sessionId={c.sessionId} control />
                  ) : (
                    <PixelLink href={`/recruteur/sessions/${c.sessionId}`} className="px-btn-sm">
                      {state.kind === "a_noter" ? "Noter" : "Replay et grille"}
                    </PixelLink>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {devShortcuts && slot.mode === "binome" && slot.status !== "termine" && slot.status !== "annule" && <DevOpenPortal slotId={slot.id} />}
      </PixelPanel>
    </li>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <PixelPanel tone={tone} className="rc-stat">
      <p className="rc-stat-n">{value}</p>
      <p className="rc-label">{label}</p>
    </PixelPanel>
  );
}

/**
 * Tableau de bord : de haut en bas, les compteurs, puis les missions en
 * direct, à venir, passées. Présentation seule : les données viennent de
 * la page (ou de la démo /dev/recruteur).
 */
export function DashboardView({
  slots: rawSlots,
  titles,
  evaluated,
  now,
  devShortcuts = false,
}: {
  slots: DashboardSlot[];
  titles: ReadonlyMap<string, string>;
  evaluated: ReadonlySet<string>;
  now: Date;
  devShortcuts?: boolean;
}) {
  const slots = rawSlots.map((s) => ({ ...s, status: effectiveSlotStatus(s, now) }));
  const groups = groupSlots(slots);
  const counts = tally(
    slots.map((s) => ({ status: s.status, candidates: s.candidates.map((c) => ({ status: c.status, deadline: c.deadline, evaluatedByMe: evaluated.has(c.sessionId) })) })),
    now,
  );
  const sections: { key: "direct" | "venir" | "passees"; label: string; tone: Tone }[] = [
    { key: "direct", label: "En direct", tone: "green" },
    { key: "venir", label: "À venir", tone: "cyan" },
    { key: "passees", label: "Passées", tone: "violet" },
  ];

  return (
    <main className="rc-main">
      <div className="rc-page-head">
        <div>
          <h1 className="rc-h1">
            <Mission>Missions</Mission>
          </h1>
          <p className="rc-sub">Vos créneaux d&apos;entretien : qui joue, qui attend, qui reste à noter.</p>
        </div>
        <PixelLink href="/recruteur/creneaux/nouveau" variant="primary">
          Nouvelle mission
        </PixelLink>
      </div>

      <div className="rc-stats">
        <Stat label="Candidats en direct" value={counts.enCours} tone="green" />
        <Stat label="Sessions à noter" value={counts.aNoter} tone="amber" />
        <Stat label="Missions à venir" value={counts.aVenir} tone="cyan" />
      </div>

      {slots.length === 0 ? (
        <PixelStatus>
          <p className="px-status-title">Aucune mission pour l&apos;instant.</p>
          <p>Créez une <Mission>mission</Mission> pour générer les liens candidat.</p>
        </PixelStatus>
      ) : (
        sections.map(
          (sec) =>
            groups[sec.key].length > 0 && (
              <section key={sec.key} aria-labelledby={`rc-sec-${sec.key}`} className="rc-section">
                <h2 id={`rc-sec-${sec.key}`} className="rc-label rc-section-h">
                  {sec.label} · {groups[sec.key].length}
                </h2>
                <ul className="rc-slots">
                  {groups[sec.key].map((s) => (
                    <SlotCard key={s.id} slot={s} title={titles.get(s.scenario) ?? s.scenario} evaluated={evaluated} now={now} tone={sec.tone} devShortcuts={devShortcuts} />
                  ))}
                </ul>
              </section>
            ),
        )
      )}

      {groups.direct.length > 0 && <LiveRefresh />}
    </main>
  );
}
