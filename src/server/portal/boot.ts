// Branche le Portail sur la vraie base, le vrai contenu et le vrai bac à
// sable. Chargé par server.ts (après server-only-stub.ts).
import type { Server as HttpServer } from "node:http";
import { MalformedAnswerError } from "@/engine/validators/errors";
import { loadInstance } from "@/server/content/registry";
import { db } from "@/server/db/client";
import { gradePortail } from "@/server/grading/portail";
import { getSandbox } from "@/server/sandbox/pool";
import { attachPortal, GradeRefused, type PortalDeps, type PortalHub } from "./hub";
import { verifyObserverToken } from "./observer-token";
import * as pg from "./pg";

export function realDeps(): PortalDeps {
  const d = db();
  return {
    now: () => new Date(),
    sessionFromCookie: pg.sessionFromCookie,
    slotFromObserverToken: (t) => verifyObserverToken(t),
    slotOfSession: (id) => pg.loadSlotInfoOfSession(d, id),
    slot: (id) => pg.loadSlotInfo(d, id),
    stage: (info) => loadInstance(info.scenario, info.seed).stages.portail.public,
    grade: async (info, code, now) => {
      const stage = loadInstance(info.scenario, info.seed).stages.portail;
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
    saveRoom: (id, patch) => pg.saveRoom(d, id, patch),
    journal: pg.journal(d),
  };
}

export function startPortal(httpServer: HttpServer): PortalHub {
  return attachPortal(httpServer, realDeps());
}
