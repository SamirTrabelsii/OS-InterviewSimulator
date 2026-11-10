import { connection } from "next/server";
import { pool } from "@/server/db/client";
import { checkHealth } from "@/server/health";

export async function GET() {
  await connection(); // jamais prérendu : on veut l'état réel au moment de l'appel
  const report = await checkHealth(() => pool().query("select 1"));
  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
