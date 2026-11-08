import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { createBotWorkerConfig, validateBotProfile } from "../scripts/bot-profiles.mjs";

const source = JSON.parse(await fs.readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
const profile = {
  slug: "second-bot",
  workerName: "rngdle-automation-second",
  controlUrl: "https://rngdle-automation-second.example.workers.dev",
  rngdleEmail: "second@example.com",
};

test("validates an independent bot profile", () => {
  assert.equal(validateBotProfile(profile, source.name, source.vars.CONTROL_PUBLIC_URL), profile);
});

test("rejects unsafe profile identifiers and invalid email", () => {
  assert.throws(() => validateBotProfile({ ...profile, slug: "../primary" }, source.name), /slug/);
  assert.throws(() => validateBotProfile({ ...profile, workerName: source.name }, source.name), /existing primary Worker/);
  assert.throws(() => validateBotProfile({ ...profile, rngdleEmail: "not-an-email" }, source.name), /email/);
});

test("rejects primary URL, non-HTTPS URL, and URL paths", () => {
  assert.throws(() => validateBotProfile({ ...profile, controlUrl: "https://rngdle-automation.blaiser509-d39.workers.dev" }, source.name, source.vars.CONTROL_PUBLIC_URL), /existing primary Worker URL/);
  assert.throws(() => validateBotProfile({ ...profile, controlUrl: "http://other.example" }, source.name), /HTTPS/);
  assert.throws(() => validateBotProfile({ ...profile, controlUrl: "https://other.example/login" }, source.name), /origin/);
});

test("creates a separate Worker config without embedding account credentials", () => {
  const config = createBotWorkerConfig(source, profile);
  assert.equal(config.name, profile.workerName);
  assert.equal(config.vars.CONTROL_PUBLIC_URL, profile.controlUrl);
  assert.equal(config.vars.RNGDLE_EMAIL, undefined);
  assert.deepEqual(config.durable_objects, source.durable_objects);
  assert.deepEqual(config.migrations, source.migrations);
  assert.notEqual(config.name, source.name);
  assert.equal(source.name, "rngdle-automation");
});
