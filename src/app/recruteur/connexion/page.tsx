import { connection } from "next/server";
import { Suspense } from "react";
import { PixelButton, PixelPanel, PixelStatus } from "@/ui/pixel/components";
import "@/ui/pixel/control/form.css";
import { buildProviders } from "@/server/auth/providers";
import { signInDev, signInWithGoogle } from "../actions";

const ERRORS: Record<string, string> = {
  AccessDenied: "Accès refusé : ce compte n'appartient pas au domaine de l'entreprise.",
  CredentialsSignin: "Accès refusé : cet email n'appartient pas au domaine de l'entreprise.",
};

async function ErrorMessage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  return <PixelStatus tone="bad">{ERRORS[error] ?? "La connexion a échoué. Réessayez."}</PixelStatus>;
}

// Lu à la requête, pas au build : en production les identifiants OAuth
// sont injectés au démarrage (Secret Manager), pas pendant `next build`.
async function ProviderButtons() {
  await connection();
  const ids = buildProviders().map((p) => {
    const cfg = (typeof p === "function" ? p() : p) as { id: string; options?: { id?: string } };
    return cfg.options?.id ?? cfg.id;
  });
  return (
    <>
      {ids.includes("google") && (
        <form action={signInWithGoogle}>
          <PixelButton type="submit" variant="primary" className="fm-full">
            Se connecter avec Google
          </PixelButton>
        </form>
      )}
      {ids.includes("dev") && (
        <form action={signInDev} className="rc-dev fm-stack">
          <p>Connexion de test (dev uniquement)</p>
          <input
            name="email"
            type="email"
            required
            defaultValue={`recruteur@${process.env.RECRUITER_EMAIL_DOMAIN ?? ""}`}
            aria-label="Email"
            className="rv-input"
          />
          <PixelButton type="submit" className="fm-full">
            Entrer comme recruteur de test
          </PixelButton>
        </form>
      )}
      {ids.length === 0 && <PixelStatus tone="warn">Aucun fournisseur de connexion n&apos;est configuré (voir .env.example).</PixelStatus>}
    </>
  );
}

export default function ConnexionPage({ searchParams }: PageProps<"/recruteur/connexion">) {
  return (
    <main className="rc-main">
      <div className="fm-center">
        <PixelPanel title="Salle de contrôle" tone="cyan" glow={1} className="fm-panel">
          <div>
            <h1 className="rc-h1">Espace recruteur</h1>
            <p className="rc-sub">Connexion réservée aux comptes de l&apos;entreprise.</p>
          </div>
          <Suspense>
            <ErrorMessage searchParams={searchParams as Promise<{ error?: string }>} />
          </Suspense>
          <Suspense fallback={<p className="rc-sub">Chargement…</p>}>
            <ProviderButtons />
          </Suspense>
        </PixelPanel>
      </div>
    </main>
  );
}
