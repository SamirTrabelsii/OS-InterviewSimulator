import NextAuth from "next-auth";
import { isAllowedRecruiter } from "@/server/auth/policy";
import { buildProviders } from "@/server/auth/providers";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: buildProviders(),
  // Derrière le serveur personnalisé et le proxy de Cloud Run.
  trustHost: true,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/recruteur/connexion", error: "/recruteur/connexion" },
  callbacks: {
    signIn: ({ account, profile, user }) =>
      isAllowedRecruiter({
        provider: account?.provider ?? "",
        email: user?.email,
        profile: profile as Record<string, unknown> | null | undefined,
      }),
  },
});
