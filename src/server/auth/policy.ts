// Règles d'accès recruteur, indépendantes du fournisseur d'identité.
// Ajouter Microsoft Entra ID = ajouter un cas dans `isAllowedRecruiter`.

export const DEV_PROVIDER_ID = "dev";

export type SignInAttempt = {
  provider: string;
  email?: string | null;
  /** Profil OAuth brut renvoyé par le fournisseur. */
  profile?: Record<string, unknown> | null;
};

export function normalizeDomain(domain: string | undefined): string | undefined {
  const d = domain?.trim().toLowerCase().replace(/^@/, "");
  return d ? d : undefined;
}

/** Email exactement dans le domaine (pas un sous-domaine, pas un suffixe). */
export function emailInDomain(email: string | null | undefined, domain: string | undefined): boolean {
  const d = normalizeDomain(domain);
  if (!email || !d) return false;
  const at = email.lastIndexOf("@");
  return at > 0 && email.slice(at + 1).toLowerCase() === d;
}

export function devLoginEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" && env.AUTH_DEV_LOGIN === "true";
}

/**
 * Décide si une tentative de connexion est acceptée. Refuse par défaut :
 * fournisseur inconnu, domaine non configuré, email non vérifié.
 */
export function isAllowedRecruiter(
  attempt: SignInAttempt,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const domain = normalizeDomain(env.RECRUITER_EMAIL_DOMAIN);
  if (!domain) return false;

  switch (attempt.provider) {
    case "google": {
      const p = attempt.profile ?? {};
      // `hd` est le domaine Workspace : un compte Gmail personnel n'en a pas.
      return (
        p.email_verified === true &&
        typeof p.hd === "string" &&
        p.hd.toLowerCase() === domain &&
        emailInDomain(typeof p.email === "string" ? p.email : attempt.email, domain)
      );
    }
    case DEV_PROVIDER_ID:
      return devLoginEnabled(env) && emailInDomain(attempt.email, domain);
    default:
      return false;
  }
}
