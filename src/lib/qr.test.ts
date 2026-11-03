import assert from "node:assert/strict";
import { test } from "node:test";

import { qrPath, shortLink } from "./qr.ts";

const URL = "https://checky.mg/verdicts/2b1f0c7e-1111-4222-8333-944445555666#s=eyJpZCI6IngifQ.k1.c2lnbmF0dXJl";

test("the seal QR is one path inside its quiet zone", () => {
  const { box, d } = qrPath(URL);
  assert.ok(box >= 23 && box % 2 === 1, `odd module count with margins: ${box}`);
  assert.match(d, /^M1 1h7v1h-7z/, "the top-left finder starts the path at the margin");
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
    const [x, y, run] = [Number(m[1]), Number(m[2]), Number(m[3])];
    assert.ok(x >= 1 && y >= 1 && x + run <= box - 1 && y <= box - 2, `module inside the zone: ${m[0]}`);
  }
});

test("the same text draws the same QR", () => {
  assert.deepEqual(qrPath(URL), qrPath(URL));
  assert.notDeepEqual(qrPath(URL).d, qrPath(URL + "x").d);
});

test("the short link names the verification number on the seal's host", () => {
  assert.equal(shortLink({ url: URL, number: 145 }), "checky.mg/v/145");
  assert.equal(shortLink({ url: URL, number: null }), null);
  assert.equal(shortLink(null), null);
});
