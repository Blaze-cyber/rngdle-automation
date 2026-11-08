#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createBotWorkerConfig, validateBotProfile } from "./bot-profiles.mjs";

const [command, ...args] = process.argv.slice(2);
const root = path.resolve("data/bots");
const readBase = async () => JSON.parse(await fs.readFile("wrangler.jsonc", "utf8"));
const profilePath = (slug) => path.join(root, slug, "profile.json");

if (command === "create") {
  const [slug, workerName, controlUrl, rngdleEmail] = args;
  if (![slug, workerName, controlUrl, rngdleEmail].every(Boolean)) {
    throw new Error("Usage: pnpm bots create <slug> <worker-name> <https-control-origin> <rngdle-email>");
  }
  const source = await readBase();
  const profile = { slug, workerName, controlUrl, rngdleEmail };
  validateBotProfile(profile, source.name, source.vars?.CONTROL_PUBLIC_URL);
  const directory = path.join(root, slug);
  try { await fs.access(directory); throw new Error(`Profile already exists: ${slug}`); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const config = createBotWorkerConfig(source, profile);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.writeFile(profilePath(slug), JSON.stringify(profile, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  await fs.writeFile(path.join(directory, "wrangler.jsonc"), JSON.stringify(config, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  await fs.chmod(profilePath(slug), 0o600);
  await fs.chmod(path.join(directory, "wrangler.jsonc"), 0o600);
  console.log(JSON.stringify({
    created: slug,
    worker: workerName,
    controlUrl,
    files: [profilePath(slug), path.join(directory, "wrangler.jsonc")],
    next: [
      "Set this profile's Worker secrets individually with Wrangler using --config data/bots/" + slug + "/wrangler.jsonc",
      "Required secrets: RNGDLE_EMAIL, SMTP_USER, SMTP_PASSWORD (or SMTP OAuth secrets), MAIL_TO, CONTROL_PASSWORD, MIGRATION_TOKEN",
      "Do not run the primary bot's cloudflare secrets command for this profile",
      "No Worker has been deployed by this command"
    ]
  }, null, 2));
} else if (command === "list") {
  let entries = [];
  try { entries = await fs.readdir(root, { withFileTypes: true }); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const profiles = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    try {
      const profile = JSON.parse(await fs.readFile(profilePath(entry.name), "utf8"));
      validateBotProfile(profile, (await readBase()).name, (await readBase()).vars?.CONTROL_PUBLIC_URL);
      profiles.push({ slug: profile.slug, workerName: profile.workerName, controlUrl: profile.controlUrl });
    } catch (error) { profiles.push({ slug: entry.name, invalid: error.message }); }
  }
  console.log(JSON.stringify(profiles, null, 2));
} else if (command === "validate") {
  const [slug] = args;
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug)) throw new Error("Usage: pnpm bots validate <safe-slug>");
  const profile = JSON.parse(await fs.readFile(profilePath(slug), "utf8"));
  const config = createBotWorkerConfig(await readBase(), profile);
  console.log(JSON.stringify({ valid: true, worker: config.name, durableObjectBinding: "AUTOMATION", deployed: false }, null, 2));
} else {
  console.log("Commands: create <slug> <worker-name> <https-control-origin> <rngdle-email>, list, validate <slug>");
  process.exitCode = command ? 1 : 0;
}
