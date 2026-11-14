import { connection } from "next/server";
import { z } from "zod";
import { currentRecruiter } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { loadMyEvaluation, saveEvaluation } from "@/server/grading/evaluations";

// Notes et adéquation : réservées aux recruteurs, et chacun ne relit que SA notation.
const NO_STORE = { "Cache-Control": "no-store" };

type Prepared = { error: Response } | { error?: undefined; recruiter: { email: string }; sessionId: string };

async function prepare(ctx: { params: Promise<{ id: string }> }): Promise<Prepared> {
  await connection();
  const recruiter = await currentRecruiter();
  if (!recruiter) return { error: Response.json({ error: "Non autorisé" }, { status: 401 }) };
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return { error: Response.json({ error: "Session invalide" }, { status: 400 }) };
  return { recruiter, sessionId: id.data };
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = await prepare(ctx);
  if (p.error) return p.error;
  return Response.json({ evaluation: await loadMyEvaluation(db(), p.sessionId, p.recruiter.email) }, { headers: NO_STORE });
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = await prepare(ctx);
  if (p.error) return p.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps invalide" }, { status: 400 });
  }
  try {
    const evaluation = await saveEvaluation(db(), p.sessionId, p.recruiter.email, body);
    if (!evaluation) return Response.json({ error: "Session introuvable" }, { status: 404 });
    return Response.json({ evaluation }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "Notation invalide" }, { status: 400 });
    throw e;
  }
}
