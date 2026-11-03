import assert from "node:assert/strict";
import { test } from "node:test";
import { speechExcerpt } from "./assistant-voice.ts";

test("spoken answers omit citation notation, not the actual explanation", () => {
  assert.deepEqual(speechExcerpt("**La rédaction confirme** [1, 2]. Source 【3†document】.", 900), { text: "La rédaction confirme. Source.", clipped: false });
});

test("the public speech endpoint receives a bounded, explicitly identified excerpt", () => {
  const result = speechExcerpt("Une phrase avec des éléments. ".repeat(100), 900);
  assert.ok(result.text.length <= 900);
  assert.equal(result.clipped, true);
  assert.equal(result.text.endsWith("élé"), false);
});
