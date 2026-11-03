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

for (const [name, dict] of [["fr", fr], ["en", merge(fr, en)], ["mg", merge(fr, mg)]] as const) {
  test(`${name}: the radio line names the newsroom, the claim and the verdict; the unverified line no verdict`, () => {
    const word = dict.verdict.false;
    const line = dict.antenne.line("Radio Test", "Des ravisseurs à Antsirabe", word, "Aucun enlèvement signalé.");
    for (const part of ["Radio Test", "Des ravisseurs à Antsirabe", word.toLowerCase(), "Aucun enlèvement signalé."]) assert.ok(line.includes(part), `${name}: ${part} in ${line}`);
    // Read on air when nothing is published: it must not carry a verdict word (as a word, not inside one).
    for (const v of [dict.verdict.true, dict.verdict.false, dict.verdict.misleading]) {
      assert.ok(!new RegExp(`(^|[^\\p{L}])${v}($|[^\\p{L}])`, "iu").test(dict.antenne.unverifiedLine), `${name}: unverified line says ${v}`);
    }
  });
}
