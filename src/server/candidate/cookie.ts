import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Cookie de session candidat : `<sessionId>.<deviceId>.<signature>`.
// Signé (HMAC-SHA256) avec AUTH_SECRET, séparé par un préfixe de domaine
// pour qu'une signature d'un autre usage ne soit jamais réutilisable ici.

export const CANDIDATE_COOKIE = "portail_candidat";
export const CANDIDATE_COOKIE_MAX_AGE = 4 * 60 * 60; // s

export type CandidateCookie = { sessionId: string; deviceId: string };

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET manquant ou trop court");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", `candidate-cookie:${secret()}`).update(payload).digest("base64url");
}

export function newDeviceId(): string {
  return randomBytes(12).toString("base64url");
}

export function encodeCandidateCookie({ sessionId, deviceId }: CandidateCookie): string {
  const payload = `${sessionId}.${deviceId}`;
  return `${payload}.${sign(payload)}`;
}

export function decodeCandidateCookie(value: string | undefined): CandidateCookie | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [sessionId, deviceId, sig] = parts;
  const expected = Buffer.from(sign(`${sessionId}.${deviceId}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^[0-9a-f-]{36}$/.test(sessionId)) return null;
  return { sessionId, deviceId };
}
