const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store" },
});

function equalSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(request, env) {
  const expected = env.HISTORY_API_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(expected) && equalSecret(supplied, expected);
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > 64 * 1024) throw new Error("Request body too large");
  return JSON.parse(text || "{}");
}

function validatePull(value) {
  return value && typeof value.botId === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(value.botId)
    && typeof value.gameDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.gameDate)
    && Number.isSafeInteger(value.rollNumber) && value.rollNumber >= 0
    && Number.isFinite(value.earnedEp) && value.earnedEp >= 0
    && (value.totalEp === null || value.totalEp === undefined || (Number.isFinite(value.totalEp) && value.totalEp >= 0))
    && typeof value.rarity === "string" && value.rarity.length <= 24
    && Array.isArray(value.badges);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true });
    if (!authorized(request, env)) return json({ error: "Unauthorized" }, 401);
    if (url.pathname === "/v1/pulls" && request.method === "POST") {
      let pull;
      try { pull = await readBody(request); } catch { return json({ error: "Invalid JSON or body too large" }, 400); }
      if (!validatePull(pull)) return json({ error: "Invalid pull record" }, 400);
      const result = await env.DB.prepare(
        `INSERT OR IGNORE INTO pulls
          (bot_id, game_date, roll_number, earned_ep, total_ep, rarity, badges_json, rolled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        pull.botId, pull.gameDate, pull.rollNumber, pull.earnedEp, pull.totalEp ?? null,
        pull.rarity.toLowerCase(), JSON.stringify(pull.badges), pull.rolledAt ?? null
      ).run();
      return json({ recorded: true, inserted: result.meta.changes === 1 });
    }
    if (url.pathname === "/v1/pulls" && request.method === "GET") {
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit")) || 100));
      const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
      const botId = url.searchParams.get("botId");
      const rarity = url.searchParams.get("rarity");
      let query = "SELECT bot_id AS botId, game_date AS gameDate, roll_number AS rollNumber, earned_ep AS earnedEp, total_ep AS totalEp, rarity, badges_json AS badgesJson, rolled_at AS rolledAt, created_at AS createdAt FROM pulls";
      const clauses = [];
      const values = [];
      if (botId) { clauses.push("bot_id = ?"); values.push(botId); }
      if (rarity) { clauses.push("rarity = ?"); values.push(rarity.toLowerCase()); }
      if (clauses.length) query += " WHERE " + clauses.join(" AND ");
      query += " ORDER BY game_date DESC, created_at DESC LIMIT ? OFFSET ?";
      values.push(limit, offset);
      const rows = await env.DB.prepare(query).bind(...values).all();
      return json({ pulls: rows.results.map(row => ({ ...row, badges: JSON.parse(row.badgesJson || "[]") })), limit, offset });
    }
    return json({ error: "Not found" }, 404);
  },
};
