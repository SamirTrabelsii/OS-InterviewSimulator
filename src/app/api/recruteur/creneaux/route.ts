import { connection } from "next/server";
import { currentRecruiter } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { listSlots } from "@/server/slots/service";

/** Liste des créneaux (JSON) — réservée aux recruteurs. */
export async function GET() {
  await connection();
  if (!(await currentRecruiter())) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  return Response.json(await listSlots(db()), { headers: { "Cache-Control": "no-store" } });
}
