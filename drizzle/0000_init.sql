CREATE TYPE "public"."event_actor" AS ENUM('candidat', 'systeme', 'recruteur');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('en_attente', 'en_cours', 'terminee', 'expiree');--> statement-breakpoint
CREATE TYPE "public"."slot_mode" AS ENUM('solo', 'binome');--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('planifie', 'en_cours', 'termine', 'annule');--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"recruiter_email" text NOT NULL,
	"grid" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"profile_fit" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"comment" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" "event_actor" NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_rooms" (
	"slot_id" uuid PRIMARY KEY NOT NULL,
	"code" text DEFAULT '' NOT NULL,
	"driver_session_id" uuid,
	"opened_at" timestamp with time zone,
	"solved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" uuid NOT NULL,
	"candidate_name" text NOT NULL,
	"token_hash" text NOT NULL,
	"seed" bigint NOT NULL,
	"status" "session_status" DEFAULT 'en_attente' NOT NULL,
	"started_at" timestamp with time zone,
	"deadline" timestamp with time zone,
	"gems" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario" text NOT NULL,
	"mode" "slot_mode" NOT NULL,
	"status" "slot_status" DEFAULT 'planifie' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_rooms" ADD CONSTRAINT "portal_rooms_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_rooms" ADD CONSTRAINT "portal_rooms_driver_session_id_sessions_id_fk" FOREIGN KEY ("driver_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evaluations_session_recruiter_idx" ON "evaluations" USING btree ("session_id","recruiter_email");--> statement-breakpoint
CREATE UNIQUE INDEX "events_session_seq_idx" ON "events" USING btree ("session_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_slot_idx" ON "sessions" USING btree ("slot_id");