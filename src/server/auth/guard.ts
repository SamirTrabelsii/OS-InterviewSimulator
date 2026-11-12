import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { emailInDomain } from "./policy";

export type Recruiter = { email: string; name: string };

/**
 * Recruteur connecté, ou null. Le domaine est revérifié à chaque requête :
 * changer RECRUITER_EMAIL_DOMAIN révoque immédiatement les sessions.
 */
export async function currentRecruiter(): Promise<Recruiter | null> {
  // Toujours à la requête : la session dépend des cookies, et Auth.js
  // utilise crypto, interdit pendant le prérendu (cacheComponents).
  await connection();
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !emailInDomain(email, process.env.RECRUITER_EMAIL_DOMAIN)) return null;
  return { email, name: session.user?.name ?? email };
}

/** Pour les pages : redirige vers la connexion si besoin. */
export async function requireRecruiter(): Promise<Recruiter> {
  const r = await currentRecruiter();
  if (!r) redirect("/recruteur/connexion");
  return r;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Non autorisé");
  }
}

/** Pour les actions serveur et les routes d'API : lève une erreur. */
export async function assertRecruiter(): Promise<Recruiter> {
  const r = await currentRecruiter();
  if (!r) throw new UnauthorizedError();
  return r;
}
