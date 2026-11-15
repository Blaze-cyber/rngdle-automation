# RNGdle central pull history

This Worker stores one record per bot per RNGdle game date in a Cloudflare D1 database. Repeated submissions are idempotent. Every bot can write to the same API, and an authenticated read endpoint returns the combined history.

## Create and deploy once

Run these commands from this directory with Wrangler authenticated to the Cloudflare account shared by the bots:

```powershell
pnpm dlx wrangler d1 create rngdle-pull-history
```

Copy the returned database ID into `wrangler.jsonc` in place of `REPLACE_WITH_D1_DATABASE_ID`, then initialize and deploy:

```powershell
pnpm dlx wrangler d1 execute rngdle-pull-history --remote --file=./schema.sql
pnpm dlx wrangler secret put HISTORY_API_TOKEN
pnpm dlx wrangler deploy
```

Use a newly generated random secret of at least 32 bytes for `HISTORY_API_TOKEN`. Do not commit it or paste it into chat.

## Configure each bot Worker

Set these Worker values/secrets for every bot:

- `PULL_HISTORY_URL`: the deployed history Worker URL, e.g. `https://rngdle-pull-history.<your-subdomain>.workers.dev`
- `PULL_HISTORY_BOT_ID`: that bot's stable factory ID (for example, `bot-eight`)
- `PULL_HISTORY_TOKEN`: the same secret stored as `HISTORY_API_TOKEN` on the history Worker

After the runtime change is deployed, each completed RNGdle pull is recorded centrally before poem/email processing. A failed history write is retried without rolling again. Automatic result emails are sent only for rolls whose normalized rarity is exactly `mythic`. Authentication-required alerts and manually requested resend actions remain available.

## Read the history

Authenticated requests:

```http
GET /v1/pulls?limit=100
Authorization: Bearer <HISTORY_API_TOKEN>
```

Optional filters: `botId` and `rarity=mythic`. Pagination uses `limit` (maximum 500) and `offset`.
