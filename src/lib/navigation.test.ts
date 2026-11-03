import assert from "node:assert/strict";
import { test } from "node:test";
import { canReviewNewsrooms, mobileRoute } from "./navigation.ts";

test("only a signed-in platform admin can open newsroom review", () => {
  assert.equal(canReviewNewsrooms(false, { platform_admin: true }), false);
  assert.equal(canReviewNewsrooms(true, undefined), false);
  assert.equal(canReviewNewsrooms(true, {}), false);
  assert.equal(canReviewNewsrooms(true, { platform_admin: false }), false);
  assert.equal(canReviewNewsrooms(true, { platform_admin: true }), true);
});

test("assistant links open the matching native screen for old and new web paths", () => {
  for (const path of ["/verdicts/abc", "/verifies/abc", "https://checky.example/verdicts/abc?q=test#sources"]) assert.equal(mobileRoute(path, false), "/citoyen/verdict/abc");
  for (const path of ["/track/abc", "/suivi/abc"]) assert.equal(mobileRoute(path, false), "/citoyen/suivi/abc");
  assert.equal(mobileRoute("/report", false), "/citoyen/signaler");
  assert.equal(mobileRoute("/w/newsroom/claims/item", true), "/affirmation/item");
  assert.equal(mobileRoute("/w/newsroom/beat", true), "/rubrique");
  assert.equal(mobileRoute("/w/newsroom/directory", true), "/annuaire");
  assert.equal(mobileRoute("/w/newsroom/affirmations/item", true), "/affirmation/item");
});

test("public assistant links cannot open journalist or admin screens", () => {
  for (const path of ["/w/newsroom/claims/item", "/w/newsroom/beat", "/administration", "/checky", "javascript:alert(1)"]) assert.equal(mobileRoute(path, false), null);
});
