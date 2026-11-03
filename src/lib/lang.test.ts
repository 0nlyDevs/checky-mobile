import assert from "node:assert/strict";
import { test } from "node:test";

import { guessLang, otherLang } from "./lang.ts";

test("recognises Malagasy and French sentences", () => {
  assert.equal(guessLang("Tsy marina ny vaovao momba ny vidin'ny vary amin'ny tsena"), "mg");
  assert.equal(guessLang("Selon le ministère, le prix du riz a doublé cette semaine"), "fr");
  assert.equal(guessLang("Efa nanao fanambarana ny minisitera fa tsy misy fiakaran'ny vidiny"), "mg");
});

test("an unknown text goes to French, and the other language flips", () => {
  assert.equal(guessLang("JIRAMA 2026 !!!"), "fr");
  assert.equal(otherLang("fr"), "mg");
  assert.equal(otherLang("mg"), "fr");
});
