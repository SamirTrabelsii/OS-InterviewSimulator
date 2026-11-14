import { createHmac, timingSafeEqual } from "node:crypto";

// Jeton d'observation d'un recruteur : `<créneau>.<expiration>.<signature>`.
// Émis par une route réservée aux recruteurs connectés (domaine vérifié),
// présenté à Socket.IO. Court (5 min) et lié à UN créneau ; le client en
// redemande un à chaque reconnexion.

export const OBSERVER_TOKEN_TTL_MS = 5 * 60_000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET manquant ou trop court");
  return s;
}

const sign = (payload: string) => createHmac("sha256", `observer-token:${secret()}`).update(payload).digest("base64url");

export function issueObserverToken(slotId: string, now: Date = new Date()): string {
  const payload = `${slotId}.${now.getTime() + OBSERVER_TOKEN_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Créneau du jeton, ou null s'il est invalide, falsifié ou expiré. */
export function verifyObserverToken(token: unknown, now: Date = new Date()): string | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [slotId, exp, sig] = parts;
  if (!/^[0-9a-f-]{36}$/.test(slotId) || !/^\d{1,15}$/.test(exp)) return null;
  const expected = Buffer.from(sign(`${slotId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return Number(exp) > now.getTime() ? slotId : null;
}
