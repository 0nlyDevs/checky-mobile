// Pure (no React Native import): tested with node --test.

/** Words that only Malagasy uses often; French and English share none of them. */
const MG = new Set(
  "ny sy ary dia fa tsy izy ireo izao amin ho an no aho isika izahay ianao ianareo azy azo mba raha ka koa satria nefa efa mbola noho tamin hoe hoy eto ao any teo manao nanao misy tsara marina vaovao olona vola fanjakana minisitera".split(
    " ",
  ),
);
const FR = new Set(
  "le la les des un une du de et est sont pas que qui dans pour sur avec au aux ce cette il elle ils nous vous on mais ou par plus ne se sa son ses leur été être fait selon".split(" "),
);

/** French or Malagasy, by counting each language's common words. Ties go to French. */
export function guessLang(text: string): "fr" | "mg" {
  const words = text
    .toLowerCase()
    .replace(/[’']/g, " ")
    .split(/[^a-zàâäçéèêëîïôöùûüÿœ]+/)
    .filter(Boolean);
  let mg = 0;
  let fr = 0;
  for (const w of words) {
    if (MG.has(w)) mg++;
    if (FR.has(w)) fr++;
  }
  return mg > fr ? "mg" : "fr";
}

/** « Traduire FR ↔ MG »: the other language. */
export const otherLang = (l: "fr" | "mg"): "fr" | "mg" => (l === "fr" ? "mg" : "fr");
