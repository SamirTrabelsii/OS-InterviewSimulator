/** La page de démonstration des composants n'existe qu'en dev (jamais en production). */
export function isDevUiEnabled(env: string | undefined = process.env.NODE_ENV): boolean {
  return env !== "production";
}
