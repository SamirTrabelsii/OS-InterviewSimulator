import { connection } from "next/server";
import { z } from "zod";
import { currentRecruiter } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { loadReplay } from "@/server/grading/evaluations";

/** Journal d'une session pour le replay — réservé aux recruteurs. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  if (!(await currentRecruiter())) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "Session invalide" }, { status: 400 });
  const replay = await loadReplay(db(), id.data);
  if (!replay) return Response.json({ error: "Session introuvable" }, { status: 404 });
  return Response.json(replay, { headers: { "Cache-Control": "no-store" } });
}
