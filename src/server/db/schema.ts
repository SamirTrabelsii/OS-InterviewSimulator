// Schéma PostgreSQL v1 (voir docs/ARCHITECTURE.md § 3.12).
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const slotMode = pgEnum("slot_mode", ["solo", "binome"]);
export const slotStatus = pgEnum("slot_status", ["planifie", "en_cours", "termine", "annule"]);
export const sessionStatus = pgEnum("session_status", ["en_attente", "en_cours", "terminee", "expiree"]);
export const eventActor = pgEnum("event_actor", ["candidat", "systeme", "recruteur"]);

/** Créneau d'entretien : un scénario, une heure, 1 ou 2 candidats. */
export const slots = pgTable("slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  scenario: text("scenario").notNull(),
  mode: slotMode("mode").notNull(),
  status: slotStatus("status").notNull().default("planifie"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  // T0 commun aux candidats du créneau : premier clic sur « Commencer ».
  startedAt: timestamp("started_at", { withTimezone: true }),
  createdBy: text("created_by").notNull(), // email du recruteur
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Un candidat dans un créneau. Le jeton du lien n'est stocké que haché. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "cascade" }),
    candidateName: text("candidate_name").notNull(),
    tokenHash: text("token_hash").notNull(),
    seed: bigint("seed", { mode: "bigint" }).notNull(),
    status: sessionStatus("status").notNull().default("en_attente"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    deadline: timestamp("deadline", { withTimezone: true }),
    gems: text("gems").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sessions_token_hash_idx").on(t.tokenHash), index("sessions_slot_idx").on(t.slotId)],
);

/** Journal en ajout seul, source du replay. */
export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    actor: eventActor("actor").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
  },
  (t) => [uniqueIndex("events_session_seq_idx").on(t.sessionId, t.seq)],
);

/** État persistant de la salle du Portail (un par créneau). */
export const portalRooms = pgTable("portal_rooms", {
  slotId: uuid("slot_id")
    .primaryKey()
    .references(() => slots.id, { onDelete: "cascade" }),
  code: text("code").notNull().default(""),
  driverSessionId: uuid("driver_session_id").references(() => sessions.id, { onDelete: "set null" }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  solvedAt: timestamp("solved_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Notation par un recruteur. Jamais exposée côté candidat. */
export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    recruiterEmail: text("recruiter_email").notNull(),
    grid: jsonb("grid").notNull().default({}), // compétence -> note
    profileFit: jsonb("profile_fit").notNull().default({}), // profil -> adéquation
    comment: text("comment"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("evaluations_session_recruiter_idx").on(t.sessionId, t.recruiterEmail)],
);
