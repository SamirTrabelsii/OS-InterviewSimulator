import { connection } from "next/server";
import { Suspense } from "react";
import { buildProviders } from "@/server/auth/providers";
import { signInDev, signInWithGoogle } from "../actions";

const ERRORS: Record<string, string> = {
  AccessDenied: "Accès refusé : ce compte n'appartient pas au domaine de l'entreprise.",
  CredentialsSignin: "Accès refusé : cet email n'appartient pas au domaine de l'entreprise.",
};

async function ErrorMessage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
      {ERRORS[error] ?? "La connexion a échoué. Réessayez."}
    </p>
  );
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
          <button className="w-full rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">
            Se connecter avec Google
          </button>
        </form>
      )}
      {ids.includes("dev") && (
        <form action={signInDev} className="space-y-2 rounded-md border border-dashed border-amber-500 p-3">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Connexion de test (dev uniquement)</p>
          <input
            name="email"
            type="email"
            required
            defaultValue={`recruteur@${process.env.RECRUITER_EMAIL_DOMAIN ?? ""}`}
            aria-label="Email"
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
          <button className="w-full rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-500">
            Entrer comme recruteur de test
          </button>
        </form>
      )}
      {ids.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Aucun fournisseur de connexion n&apos;est configuré (voir .env.example).
        </p>
      )}
    </>
  );
}

export default function ConnexionPage({ searchParams }: PageProps<"/recruteur/connexion">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Espace recruteur</h1>
      <Suspense>
        <ErrorMessage searchParams={searchParams as Promise<{ error?: string }>} />
      </Suspense>
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
        <ProviderButtons />
      </Suspense>
    </main>
  );
}
