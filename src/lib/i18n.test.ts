import assert from "node:assert/strict";
import { test } from "node:test";

import { firstSentence, langFromLocale, leaves, merge } from "./i18n/core.ts";
import { en } from "./i18n/en.ts";
import { t as fr } from "./i18n/fr.ts";
import { mg } from "./i18n/mg.ts";

test("the phone's language picks the starting language", () => {
  assert.equal(langFromLocale("mg-MG"), "mg");
  assert.equal(langFromLocale("fr_MG"), "fr");
  assert.equal(langFromLocale("fr-FR"), "fr");
  assert.equal(langFromLocale("en-US"), "en");
  assert.equal(langFromLocale("de-DE"), "en");
  assert.equal(langFromLocale(null), "en");
});

test("a key the translation lacks stays French", () => {
  const merged = merge({ a: "un", b: { c: "deux", d: "trois" } }, { b: { c: "two" } });
  assert.deepEqual(merged, { a: "un", b: { c: "two", d: "trois" } });
});

for (const [name, dict] of [["en", en], ["mg", mg]] as const) {
  test(`${name}: every key exists in French with the same kind of value`, () => {
    const fromFr = new Map(leaves(fr).map((k) => [k, typeof k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], fr)]));
    for (const key of leaves(dict)) {
      const value = key.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], dict);
      // Open records (`as Record<string, …>`) may hold keys of their own; their parent must exist.
      const parent = key.split(".").slice(0, -1).join(".");
      assert.ok(fromFr.has(key) || [...fromFr.keys()].some((k) => k.startsWith(`${parent}.`)), `${name}: unknown key ${key}`);
      if (fromFr.has(key)) assert.equal(typeof value, fromFr.get(key), `${name}: ${key} is a ${typeof value}`);
    }
  });
}

test("the radio line takes one sentence of the reason", () => {
  assert.equal(firstSentence("Aucun enlèvement signalé. La gendarmerie dément."), "Aucun enlèvement signalé.");
  assert.equal(firstSentence("Pas de point final"), "Pas de point final.");
  assert.equal(firstSentence(""), "");
  assert.ok(firstSentence("x".repeat(400)).length <= 220);
});
