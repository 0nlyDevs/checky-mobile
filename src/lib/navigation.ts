/** Shared navigation rules. The API remains the authority for every admin action. */
export function canReviewNewsrooms(signedIn: boolean, me: { platform_admin?: boolean } | undefined): boolean {
  return signedIn && me?.platform_admin === true;
}

export function mobileRoute(href: string, desk: boolean): string | null {
  const path = href.replace(/^https?:\/\/[^/]+/, "").split(/[?#]/)[0];
  let match: RegExpMatchArray | null;
  if ((match = path.match(/^\/(?:verdicts|verifies)\/([\w-]+)$/))) return `/citoyen/verdict/${match[1]}`;
  if (["/verdicts", "/verifies"].includes(path)) return "/verdicts";
  if (!desk && (match = path.match(/^\/(?:track|suivi)\/([\w-]+)$/))) return `/citoyen/suivi/${match[1]}`;
  if (!desk && ["/report", "/signaler"].includes(path)) return "/citoyen/signaler";
  if (["/scanner"].includes(path)) return "/scanner";
  if (!desk) return null;
  if ((match = path.match(/^\/w\/[\w-]+\/(?:claims|affirmations)\/([\w-]+)$/))) return `/affirmation/${match[1]}`;
  const page = path.match(/^\/w\/[\w-]+\/([\w-]+)$/)?.[1];
  const routes: Record<string, string> = { claims: "/affirmations", affirmations: "/affirmations", verify: "/", verifier: "/", analyze: "/", analyser: "/", beat: "/rubrique", rubrique: "/rubrique", settings: "/reglages", parametres: "/reglages", directory: "/annuaire", annuaire: "/annuaire", figures: "/chiffres", chiffres: "/chiffres", registry: "/registre", registre: "/registre" };
  return page ? routes[page] ?? null : null;
}
