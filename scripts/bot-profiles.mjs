import { splitWorkerBindings } from "../src/cloud/config.js";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const WORKER = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function validateBotProfile(profile, primaryWorkerName) {
  if (!profile || typeof profile !== "object") throw new Error("Bot profile must be an object");
  if (!SLUG.test(profile.slug ?? "")) throw new Error("Bot profile slug must use lowercase letters, numbers, and hyphens");
  if (!WORKER.test(profile.workerName ?? "")) throw new Error("Worker name must use lowercase letters, numbers, and hyphens");
  if (profile.workerName === primaryWorkerName) throw new Error("A bot profile cannot target the existing primary Worker");
  if (typeof profile.rngdleEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.rngdleEmail)) {
    throw new Error("A valid RNGdle account email is required");
  }
  let url;
  try { url = new URL(profile.controlUrl); } catch { throw new Error("Control URL must be a valid HTTPS URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Control URL must be an HTTPS origin without credentials, path, query, or fragment");
  }
  if (url.hostname === "rngdle-automation.blaiser509-d39.workers.dev") {
    throw new Error("A bot profile cannot use the existing primary Worker URL");
  }
  return profile;
}

export function createBotWorkerConfig(source, profile) {
  validateBotProfile(profile, source.name);
  const config = structuredClone(source);
  config.name = profile.workerName;
  config.vars = { ...config.vars, CONTROL_PUBLIC_URL: profile.controlUrl, RNGDLE_EMAIL: undefined };
  delete config.vars.RNGDLE_EMAIL;
  const bindings = config.durable_objects?.bindings ?? [];
  if (!bindings.some((binding) => binding.name === "AUTOMATION" && binding.class_name === "Automation")) {
    throw new Error("Base Wrangler config is missing the Automation Durable Object binding");
  }
  if (!config.migrations?.some((migration) => migration.new_sqlite_classes?.includes("Automation"))) {
    throw new Error("Base Wrangler config is missing the Automation SQLite migration");
  }
  const unsafe = splitWorkerBindings(config.vars).secrets;
  if (Object.keys(unsafe).length) throw new Error(`Secret values cannot be written to profile config: ${Object.keys(unsafe).join(", ")}`);
  return config;
}
