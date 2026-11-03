import assert from "node:assert/strict";
import { test } from "node:test";

import { debunkText } from "./debunk.ts";

const by = (n: string) => `Vérifié par ${n}`;

test("the démenti uses the newsroom's post and its link", () => {
  const v = { title: "Le riz a doublé", reason: "Prix stable selon l'INSTAT.", post: "FAUX : le prix du riz est stable.", newsroom: { name: "Radio Démo" } };
  assert.equal(debunkText(v, "Faux", "https://x/verdicts/1", by), "FAUX : le prix du riz est stable.\nVérifié par Radio Démo : https://x/verdicts/1");
});

test("without a post it falls back to the signed word and reason, clipped", () => {
  const v = { title: "Le riz a doublé", reason: "mot ".repeat(400), post: null, newsroom: { name: "R" } };
  const text = debunkText(v, "Faux", "L", by);
  assert.ok(text.startsWith("Faux : Le riz a doublé. mot"));
  assert.ok(text.split("\n")[0].length <= 600);
  assert.ok(text.endsWith("Vérifié par R : L"));
});
