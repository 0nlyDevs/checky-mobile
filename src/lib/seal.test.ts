import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { canonical, checkSeal, communiquePayload, fingerprint, fromBase64, fromUtf8, normalise, parseSeal, utf8, type SealStore } from "./seal.ts";

// Signed by checky-platform's app/core/seal.py (verdict_payload, canonical, b64u, fingerprint), not by
// this code: the phone must accept exactly what the server signs.
const v = JSON.parse(readFileSync(new URL("./seal.vector.json", import.meta.url), "utf8"));
const store: SealStore = { keys: v.keys, revoked: v.revoked, registry: v.registry };

test("the fingerprint matches the server's on messy whitespace and accents", () => {
  assert.equal(fingerprint(v.text), v.fingerprint);
  assert.equal(normalise(" a\u00a0\u2003b\n\tc "), "a b c");
  // U+FEFF is not whitespace for Python: kept.
  assert.equal(normalise("\ufeffa"), "\ufeffa");
});

test("utf-8 and base64 round-trip", () => {
  const s = "Fin des délestages « démo » 🇲🇬";
  assert.equal(fromUtf8(utf8(s)), s);
  assert.deepEqual(Array.from(fromBase64("_-8")), [0xff, 0xef]);
  assert.throws(() => fromUtf8(Uint8Array.from([0xc3])));
});

test("a signed verdict card is authentic, with the signed title and number", () => {
  const r = checkSeal(v.verdict_url, store);
  assert.equal(r.status, "authentic");
  if (r.status !== "authentic") return;
  assert.equal(r.kind, "verdict");
  assert.equal(r.fields.title, "Le pont d'Anosy est fermé « depuis ce matin »");
  assert.equal(r.fields.ref, "FAN-0145");
  assert.equal(r.fields.verdict, "false");
  assert.equal(r.newsroom.name, "Radio Démo");
});

test("a sealed communiqué QR is authentic offline, and flagged as demo from the registry", () => {
  const r = checkSeal(v.communique_url, store);
  assert.equal(r.status, "authentic");
  if (r.status !== "authentic") return;
  assert.deepEqual(r.fields, { title: "Fin des délestages", issuer: "JIRAMA (démo)", number: "045/2026", date: "2026-11-02" });
  assert.equal(r.demo, true);
});

test("an older communiqué QR is checked against the cached registry", () => {
  assert.equal(canonical(communiquePayload(v.registry[0])), fromUtf8(fromBase64(v.communique_url.split("#")[1].split(".")[0])));
  assert.equal(checkSeal(v.legacy_url, store).status, "authentic");
  assert.equal(checkSeal(v.legacy_url, { ...store, registry: [] }).status, "not_cached");
  // The registry holds other words than were signed: no match.
  const edited = [{ ...v.registry[0], text: `${v.text} Sauf à Toamasina.` }];
  assert.equal(checkSeal(v.legacy_url, { ...store, registry: edited }).status, "mismatch");
});

test("altered words or a borrowed signature do not match", () => {
  const [base, frag] = v.communique_url.split("#");
  const [packed, sig, key] = frag.split(".");
  const msg = fromUtf8(fromBase64(packed)).replace("Fin des délestages", "Fin des délestages demain");
  const repacked = Buffer.from(msg).toString("base64url");
  assert.equal(checkSeal(`${base}#${repacked}.${sig}.${key}`, store).status, "mismatch");
  // The verdict's signature on the communiqué's words.
  const vsig = v.verdict_url.split("#")[1].split(".")[1];
  assert.equal(checkSeal(`${base}#${packed}.${vsig}.${key}`, store).status, "mismatch");
  // A verdict seal moved to another verdict's page.
  const moved = v.verdict_url.replace("3f1c2a4e-8b7d-4c1e-9a2b-5d6e7f8a9b0c", "11111111-2222-4333-8444-555555555555");
  assert.equal(checkSeal(moved, store).status, "mismatch");
  // A communiqué key cannot vouch for a verdict, nor the reverse.
  const vfrag = v.verdict_url.split("#")[1].split(".");
  assert.equal(checkSeal(`${v.verdict_url.split("#")[0]}#${vfrag[0]}.${vfrag[1]}.k_dbc298251c51321b`, store).status, "mismatch");
});

test("a revoked key is refused and an unknown one is not called fake", () => {
  const r = checkSeal(v.revoked_url, store);
  assert.equal(r.status, "revoked");
  assert.equal(checkSeal(v.communique_url, { ...store, keys: [] }).status, "unknown_issuer");
});

test("anything else is not a seal", () => {
  assert.equal(parseSeal("https://example.org/page"), null);
  assert.equal(checkSeal("WIFI:S:home;T:WPA;P:secret;;", store).status, "not_seal");
  assert.equal(parseSeal("https://checky.example/sceau/0a9b8c7d-6e5f-4a3b-2c1d-0e9f8a7b6c5d#%%%.x.y"), null);
});

test("a QR pointed at another registry entry borrows nothing from it", () => {
  const other = "11111111-2222-4333-8444-555555555555";
  const decoy = { ...v.registry[0], id: other, title: "Autre communiqué", is_demo: true };
  const plain = { ...v.registry[0], is_demo: false };
  const moved = v.communique_url.replace(v.registry[0].id, other);
  const r = checkSeal(moved, { ...store, registry: [plain, decoy] });
  assert.equal(r.status, "authentic");
  if (r.status !== "authentic") return;
  assert.equal(r.demo, false);
  // Only what was signed is shown, never the entry's fields.
  assert.equal(r.fields.title, "Fin des délestages");
  // A verdict's id never picks up a registry entry's flag either.
  const vr = checkSeal(v.verdict_url, { ...store, registry: [{ ...decoy, id: "3f1c2a4e-8b7d-4c1e-9a2b-5d6e7f8a9b0c" }] });
  assert.equal(vr.status === "authentic" && vr.demo, false);
});
