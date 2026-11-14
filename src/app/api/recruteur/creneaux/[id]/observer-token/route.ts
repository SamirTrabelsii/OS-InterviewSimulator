import { connection } from "next/server";
import { z } from "zod";
import { currentRecruiter } from "@/server/auth/guard";
import { issueObserverToken } from "@/server/portal/observer-token";

/** Jeton court pour observer la salle du Portail d'un créneau — réservé aux recruteurs. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  if (!(await currentRecruiter())) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "Créneau invalide" }, { status: 400 });
  return Response.json({ token: issueObserverToken(id.data) }, { headers: { "Cache-Control": "no-store" } });
}
