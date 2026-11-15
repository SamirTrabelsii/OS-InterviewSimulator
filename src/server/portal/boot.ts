// Branche le Portail sur la vraie base, le vrai contenu et le vrai bac à
// sable. Chargé par server.ts (après server-only-stub.ts).
import type { Server as HttpServer } from "node:http";
import { MalformedAnswerError } from "@/engine/validators/errors";
import type { ScenarioInstance } from "@/engine/content/schemas";
import { loadSessionInstance } from "@/server/content/subject";
import { db } from "@/server/db/client";
import { gradePortail } from "@/server/grading/portail";
import { getSandbox } from "@/server/sandbox/pool";
import { attachPortal, GradeRefused, type PortalDeps, type PortalHub, type SlotInfo } from "./hub";
import { verifyObserverToken } from "./observer-token";
import * as pg from "./pg";

// Le Portail lit son sujet de façon synchrone : il est chargé (depuis la base,
// où il est figé) quand le créneau est lu, puis retrouvé ici par créneau.
const portails = new Map<string, ScenarioInstance["stages"]["portail"]>();
const PORTAILS_MAX = 50;

export function realDeps(): PortalDeps {
  const d = db();
  const withSubject = async (info: SlotInfo | null): Promise<SlotInfo | null> => {
    if (info?.subjectSessionId) {
      const instance = await loadSessionInstance(d, { sessionId: info.subjectSessionId, scenarioId: info.scenario, seed: info.seed });
      portails.delete(info.slotId);
      portails.set(info.slotId, instance.stages.portail);
      if (portails.size > PORTAILS_MAX) portails.delete(portails.keys().next().value!);
    }
    return info;
  };
  const portail = (info: SlotInfo) => {
    const stage = portails.get(info.slotId);
    if (!stage) throw new Error(`Sujet du Portail non chargé pour le créneau ${info.slotId}`);
    return stage;
  };
  return {
    now: () => new Date(),
    sessionFromCookie: pg.sessionFromCookie,
    slotFromObserverToken: (t) => verifyObserverToken(t),
    slotOfSession: async (id) => withSubject(await pg.loadSlotInfoOfSession(d, id)),
    slot: async (id) => withSubject(await pg.loadSlotInfo(d, id)),
    stage: (info) => portail(info).public,
    grade: async (info, code, now) => {
      const stage = portail(info);
      const sandbox = getSandbox();
      try {
        const g = await gradePortail(stage, code, (job) => sandbox.run(job), now);
        return {
          passed: g.passed,
          total: g.total,
          logLines: g.logLines,
          ...(g.publicError ? { publicError: g.publicError } : {}),
          // Détail pour le recruteur (replay) : jamais envoyé aux candidats.
          detail: { cases: g.cases, durationMs: g.durationMs, ...(g.publicError ? { error: g.publicError } : {}) },
        };
      } catch (err) {
        if (err instanceof MalformedAnswerError) throw new GradeRefused(err.message);
        throw err;
      }
    },
    loadRoom: (id) => pg.loadRoom(d, id),
    loadChat: (id) => pg.loadChat(d, id),
    saveRoom: (id, patch) => pg.saveRoom(d, id, patch),
    journal: pg.journal(d),
  };
}

export function startPortal(httpServer: HttpServer): PortalHub {
  return attachPortal(httpServer, realDeps());
}
