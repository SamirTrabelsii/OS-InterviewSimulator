import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { DEV_PROVIDER_ID, devLoginEnabled, emailInDomain, normalizeDomain } from "./policy";

/**
 * Fournisseurs actifs selon l'environnement. Pur (pas d'effet de bord)
 * pour pouvoir vérifier en test que le faux fournisseur n'existe pas en
 * production.
 */
export function buildProviders(env: Record<string, string | undefined> = process.env): Provider[] {
  const providers: Provider[] = [];
  const domain = normalizeDomain(env.RECRUITER_EMAIL_DOMAIN);

  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        // `hd` filtre l'écran de choix de compte ; le vrai contrôle est
        // refait côté serveur dans isAllowedRecruiter().
        authorization: { params: { hd: domain, prompt: "select_account" } },
      }),
    );
  }

  // Microsoft Entra ID : à ajouter ici (next-auth/providers/microsoft-entra-id),
  // avec un cas "microsoft-entra-id" dans isAllowedRecruiter().

  if (devLoginEnabled(env)) {
    providers.push(
      Credentials({
        id: DEV_PROVIDER_ID,
        name: "Connexion de test",
        credentials: { email: { label: "Email", type: "email" } },
        authorize: (credentials) => {
          const email = String(credentials?.email ?? "").trim().toLowerCase();
          if (!emailInDomain(email, domain)) return null;
          return { id: email, email, name: email.split("@")[0] };
        },
      }),
    );
  }

  return providers;
}
