import { createHash, randomBytes } from "node:crypto";

/** Jeton de lien candidat : 32 octets aléatoires, encodés pour une URL. */
export function newCandidateToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

/** Seul ce hash est stocké en base : une fuite de la base ne donne pas les liens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Graine de session : entier positif sur 62 bits. */
export function newSeed(): bigint {
  return randomBytes(8).readBigUInt64BE() >> 2n;
}
