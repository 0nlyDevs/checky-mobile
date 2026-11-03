import assert from "node:assert/strict";
import { test } from "node:test";

import { groupByRumour, hamming, sameWords } from "./group.ts";

test("hamming counts differing bits and refuses missing hashes", () => {
  assert.equal(hamming("ffff000000000000", "ffff000000000000"), 0);
  assert.equal(hamming("ffff000000000000", "fff0000000000001"), 5);
  assert.equal(hamming(null, "ffff000000000000"), null);
  assert.equal(hamming("xyz", "abc"), null);
});

test("sameWords needs most words of the shorter claim", () => {
  assert.ok(sameWords("La JIRAMA coupe l'électricité à Antananarivo pendant trois jours", "Coupure : la Jirama coupe l'electricite trois jours a Antananarivo"));
  assert.ok(!sameWords("Le prix du riz a doublé à Toamasina", "La JIRAMA coupe l'électricité trois jours"));
  assert.ok(!sameWords("riz", "riz"));
});

test("screenshots are grouped by file, picture, followed claim and words", () => {
  const groups = groupByRumour([
    { dhash: "ffff00000000ff00", text: "Le riz a doublé" }, // 0
    { sha256: "abc" }, // 1
    { dhash: "ffff00000000ff03" }, // 2: same picture as 0, recompressed
    { sha256: "abc" }, // 3: same file as 1
    { trackedId: "item-9", text: "Examens du bac annulés à Fianarantsoa cette année" }, // 4
    { text: "Les examens du bac annulés cette année à Fianarantsoa, dit un message" }, // 5: same words as 4
    { trackedId: "item-2" }, // 6: alone
  ]);
  assert.deepEqual(
    groups.map((g) => g.members),
    [[0, 2], [1, 3], [4, 5], [6]],
  );
  assert.deepEqual(groups[0].links, ["same_picture"]);
  assert.deepEqual(groups[1].links, ["same_file"]);
  assert.deepEqual(groups[2].links, ["same_words"]);
  assert.deepEqual(groups[3].links, []);
});

test("links chain across a batch", () => {
  const groups = groupByRumour([{ sha256: "a", trackedId: "x" }, { trackedId: "x" }, { sha256: "a" }]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].members, [0, 1, 2]);
});
