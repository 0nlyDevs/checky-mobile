import { getShareExtensionKey } from "expo-share-intent";

// Screens renamed from French to English: a link made before (`fanilo://analyse?id=…`) still opens.
const MOVED: [RegExp, string][] = [
  [/^\/?citoyen\/signaler(?=[/?]|$)/, "/citizen/report"],
  [/^\/?citoyen\/suivi(?=[/?]|$)/, "/citizen/track"],
  [/^\/?citoyen\/verifier(?=[/?]|$)/, "/citizen/verify"],
  [/^\/?citoyen(?=[/?]|$)/, "/citizen"],
  [/^\/?affirmation(?=\/)/, "/claim"],
  [/^\/?(?:analyse|analyser)(?=[/?]|$)/, "/analyze"],
  [/^\/?nouvelle(?=[/?]|$)/, "/new"],
  [/^\/?accueil(?=[/?]|$)/, "/home"],
  [/^\/?bienvenue(?=[/?]|$)/, "/welcome"],
  [/^\/?connexion(?=[/?]|$)/, "/sign-in"],
  [/^\/?inscription(?=[/?]|$)/, "/sign-up"],
];

/** The English path of a screen's older French one (scheme dropped), or the path unchanged. */
function renamed(path: string): string {
  const rest = path.replace(/^[a-z][\w+.-]*:\/\/\/?/i, "");
  for (const [from, to] of MOVED) if (from.test(rest)) return rest.replace(from, to);
  return path;
}

// iOS hands shared content over through a deep link; the root layout's ShareForwarder takes it from there.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return path.includes(`dataUrl=${getShareExtensionKey()}`) ? "/" : renamed(path);
  } catch {
    return "/";
  }
}
