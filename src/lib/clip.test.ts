import assert from "node:assert/strict";
import { test } from "node:test";

import { fingerprint, rememberOffer, worthOffering } from "./clip.ts";

test("offers links and real sentences, not codes or words", () => {
  assert.equal(worthOffering(" https://www.facebook.com/share/p/abc "), "link");
  assert.equal(worthOffering("La JIRAMA coupera le courant trois jours à Antananarivo"), "text");
  assert.equal(worthOffering("483920"), null);
  assert.equal(worthOffering("bonjour"), null);
  assert.equal(worthOffering("x".repeat(30)), null);
});

test("fingerprints are stable and tell texts apart", () => {
  assert.equal(fingerprint("abc"), fingerprint("abc"));
  assert.notEqual(fingerprint("abc"), fingerprint("abd"));
});

test("offers each copied content once across intervening copies", () => {
  const a = fingerprint("first content");
  const b = fingerprint("other content");
  const first = rememberOffer(null, a);
  const second = rememberOffer(first, b);
  assert.ok(first);
  assert.ok(second);
  assert.equal(rememberOffer(second, a), null);
});
