import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { CANDIDATE_COOKIE, CANDIDATE_COOKIE_MAX_AGE, decodeCandidateCookie, encodeCandidateCookie, newDeviceId } from "@/server/candidate/cookie";
import { openLink } from "@/server/candidate/session";
import { db } from "@/server/db/client";

/**
 * Redirection relative : `request.url` contient l'adresse d'écoute du
 * serveur (0.0.0.0), pas l'adresse publique vue par le navigateur.
 */
function redirect(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path, "Referrer-Policy": "no-referrer" } });
}

/**
 * Lien personnel du candidat. Échange le jeton contre un cookie signé puis
 * redirige vers /session : le jeton ne reste ni dans l'URL affichée ni
 * dans l'historique. N'ouvre PAS la session (un aperçu de lien dans Teams
 * ne doit pas lancer le chrono) : il faut cliquer sur « Commencer ».
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/s/[token]">) {
  const { token } = await ctx.params;
  const existing = decodeCandidateCookie((await cookies()).get(CANDIDATE_COOKIE)?.value);

  const result = await openLink(db(), token, new Date(), {
    deviceId: existing?.deviceId ?? newDeviceId(),
    userAgent: request.headers.get("user-agent") ?? "",
  });

  if (!result.ok) return redirect(`/lien-invalide?raison=${result.reason}`);

  const response = redirect("/session");
  response.cookies.set(CANDIDATE_COOKIE, encodeCandidateCookie({ sessionId: result.sessionId, deviceId: result.deviceId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CANDIDATE_COOKIE_MAX_AGE,
  });
  return response;
}
