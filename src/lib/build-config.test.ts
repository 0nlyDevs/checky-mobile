import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Android release builds preserve WorkManager's reflective database constructor", () => {
  const { expo } = JSON.parse(readFileSync(new URL("../../app.json", import.meta.url), "utf8"));
  const plugin = expo.plugins.find(
    (entry: unknown) => Array.isArray(entry) && entry[0] === "expo-build-properties",
  );
  assert.ok(plugin, "native release rules must be configured through Expo prebuild");
  assert.match(
    plugin[1].android.extraProguardRules,
    /-keep\s+class\s+androidx\.work\.impl\.WorkDatabase_Impl\s*\{\s*public\s+<init>\(\);\s*\}/,
    "R8 must retain the class name and its public no-argument constructor for Room",
  );
});
