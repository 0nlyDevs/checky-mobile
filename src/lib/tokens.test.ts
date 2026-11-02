import assert from "node:assert/strict";
import { test } from "node:test";

import { contrast, dark, light, PAIRS } from "./tokens.ts";

function pick(palette: unknown, path: string): string {
  const v = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], palette);
  assert.equal(typeof v, "string", `${path} is a string`);
  return v as string;
}

test("contrast matches the measured ink on paper ratio", () => {
  assert.ok(Math.abs(contrast("#0a0a0b", "#f3f2ee") - 17.67) <= 0.05);
});

for (const [name, palette] of [["light", light], ["dark", dark]] as const) {
  test(`${name}: every text pair is at least 4.5:1`, () => {
    for (const [fg, bg] of PAIRS) {
      const ratio = contrast(pick(palette, fg), pick(palette, bg));
      assert.ok(ratio >= 4.5, `${name} ${fg} on ${bg} is ${ratio.toFixed(2)}`);
    }
  });
}

test("the active tab pill keeps ink text in dark", () => {
  assert.equal(dark.navActiveForeground, "#0a0a0b");
  assert.equal(dark.navActive, "#f3f2ee");
});
