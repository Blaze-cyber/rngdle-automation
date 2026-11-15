import assert from "node:assert/strict";
import test from "node:test";
import { advanceWorkflow } from "../src/cloud/workflow.js";

function setup(result) {
  const state = { version: 1, days: {} };
  const writes = [];
  const store = {
    async put(key, value) { writes.push({ key, value: structuredClone(value) }); },
    async setAlarm() {},
  };
  const config = {
    storage: { adapter: store },
    schedule: { retryMinutes: 1, emailRetryMinutes: 1 },
    poem: { enabled: false, retryMinutes: 1 },
  };
  const calls = { pulls: 0, history: 0, email: 0 };
  const now = () => new Date("2026-11-14T12:00:00.000Z");
  const dependencies = {
    getRoll: async () => { calls.pulls++; return structuredClone(result); },
    recordRoll: async (_config, date, roll, rolledAt) => {
      calls.history++;
      assert.equal(date, "2026-11-14");
      assert.equal(roll.earnedEp, 12345);
      assert.ok(rolledAt);
    },
    sendRoll: async () => { calls.email++; return { messageId: "test-message" }; },
    now,
  };
  return { state, config, dependencies, calls, writes };
}

test("records the roll centrally and sends an automatic email for Mythic", async () => {
  const ctx = setup({ number: 123, earnedEp: 12345, totalEp: 50000, rarity: "mythic", badges: [] });
  for (let i = 0; i < 3; i++) await advanceWorkflow(ctx.config, ctx.state, "2026-11-14", ctx.dependencies);
  const day = ctx.state.days["2026-11-14"];
  assert.equal(ctx.calls.pulls, 1);
  assert.equal(ctx.calls.history, 1);
  assert.equal(ctx.calls.email, 1);
  assert.ok(day.historyRecordedAt);
  assert.ok(day.emailSentAt);
  assert.equal(day.status, "success");
});

test("records non-Mythic rolls but skips automatic email", async () => {
  const ctx = setup({ number: 456, earnedEp: 12345, totalEp: 50000, rarity: "epic", badges: [] });
  for (let i = 0; i < 3; i++) await advanceWorkflow(ctx.config, ctx.state, "2026-11-14", ctx.dependencies);
  const day = ctx.state.days["2026-11-14"];
  assert.equal(ctx.calls.pulls, 1);
  assert.equal(ctx.calls.history, 1);
  assert.equal(ctx.calls.email, 0);
  assert.ok(day.emailSkippedAt);
  assert.equal(day.emailSkipReason, "non_mythic");
  assert.equal(day.status, "success");
});

test("does not repeat a completed pull or central-history submission", async () => {
  const ctx = setup({ number: 789, earnedEp: 12345, totalEp: 50000, rarity: "common", badges: [] });
  for (let i = 0; i < 4; i++) await advanceWorkflow(ctx.config, ctx.state, "2026-11-14", ctx.dependencies);
  assert.equal(ctx.calls.pulls, 1);
  assert.equal(ctx.calls.history, 1);
  assert.equal(ctx.calls.email, 0);
});
