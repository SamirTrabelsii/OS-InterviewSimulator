"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { assertRecruiter } from "@/server/auth/guard";
import { DEV_PROVIDER_ID } from "@/server/auth/policy";
import { listScenarios } from "@/server/content/registry";
import { db } from "@/server/db/client";
import { candidateUrl, createSlot, createSlotInput, regenerateLink } from "@/server/slots/service";

async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------- connexion

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/recruteur" });
}

export async function signInDev(formData: FormData) {
  await signIn(DEV_PROVIDER_ID, { email: String(formData.get("email") ?? ""), redirectTo: "/recruteur" });
}

export async function signOutRecruiter() {
  await signOut({ redirectTo: "/recruteur/connexion" });
}

// ---------------------------------------------------------------- créneaux

export type CreateSlotState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; links: { candidateName: string; url: string }[] };

export async function createSlotAction(_prev: CreateSlotState, formData: FormData): Promise<CreateSlotState> {
  const recruiter = await assertRecruiter();
  const parsed = createSlotInput.safeParse({
    scenario: formData.get("scenario"),
    mode: formData.get("mode"),
    scheduledAt: formData.get("scheduledAt"),
    candidates: formData.getAll("candidate").map(String).filter((c) => c.trim() !== ""),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues.map((i) => i.message).join(" ") };
  }
  const { links } = await createSlot(db(), parsed.data, recruiter.email, listScenarios().map((s) => s.id));
  const base = await baseUrl();
  revalidatePath("/recruteur");
  return { status: "ok", links: links.map((l) => ({ candidateName: l.candidateName, url: candidateUrl(base, l.token) })) };
}

export async function regenerateLinkAction(sessionId: string): Promise<{ candidateName: string; url: string }> {
  await assertRecruiter();
  const link = await regenerateLink(db(), z.uuid().parse(sessionId));
  return { candidateName: link.candidateName, url: candidateUrl(await baseUrl(), link.token) };
}
