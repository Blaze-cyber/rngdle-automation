import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/bots.mjs", import.meta.url));
const baseConfig = new URL("../wrangler.jsonc", import.meta.url);

test("bot profile CLI creates, lists, validates, and refuses overwrites", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rngdle-bots-test-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.copyFile(baseConfig, path.join(directory, "wrangler.jsonc"));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: directory, encoding: "utf8" });

  const created = run("create", "bot-two", "rngdle-automation-two", "https://rngdle-automation-two.example.workers.dev", "second@example.com");
  assert.equal(created.status, 0, created.stderr);
  assert.match(created.stdout, /"created": "bot-two"/);

  const profilePath = path.join(directory, "data", "bots", "bot-two", "profile.json");
  const workerConfigPath = path.join(directory, "data", "bots", "bot-two", "wrangler.jsonc");
  const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
  const workerConfig = JSON.parse(await fs.readFile(workerConfigPath, "utf8"));
  assert.equal(profile.rngdleEmail, "second@example.com");
  assert.equal(workerConfig.name, "rngdle-automation-two");
  assert.equal(workerConfig.vars.CONTROL_PUBLIC_URL, profile.controlUrl);
  assert.equal(workerConfig.vars.RNGDLE_EMAIL, undefined);
  assert.equal((await fs.stat(profilePath)).mode & 0o777, 0o600);

  const listed = run("list");
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /rngdle-automation-two/);

  const validated = run("validate", "bot-two");
  assert.equal(validated.status, 0, validated.stderr);
  assert.match(validated.stdout, /"valid": true/);

  const duplicate = run("create", "bot-two", "another-worker", "https://another.example.workers.dev", "other@example.com");
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /already exists/);
});
