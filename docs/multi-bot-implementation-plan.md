# Multi-bot setup: implementation and rollback plan

## Safety objective

Add repeatable setup for additional RNGdle bots without changing the currently deployed `rngdle-automation` Worker, its Durable Object data, or its secrets.

All development happens on branch `feature/multi-bot-setup`. The default branch and production deployment are not changed by this work.

## Current architecture facts

- The Worker routes API, preview, and migration requests to Durable Object binding `AUTOMATION`, object name `primary`.
- The Durable Object stores account session/cookies, automation state, logs, and scheduling metadata.
- Worker configuration reads `RNGDLE_EMAIL`, SMTP settings, `CONTROL_PASSWORD`, and `MIGRATION_TOKEN` from Worker bindings/secrets.
- `workerBuildConfig` already supports a `WORKER_NAME` override and filters secret values from plain Worker vars.
- The deployment scripts include local production config and Workers Builds paths. The local `wrangler.production.jsonc` and secret files are not present in the GitHub repository and must remain local/private.
- A distinct Worker deployment with its own Durable Object binding/namespace is the intended isolation boundary. This must be verified in the final generated Wrangler config and Cloudflare before deploying any second bot.

## Proposed user experience

Create a named bot profile (for example `bot-2`) in a private, ignored local directory. Each profile should have:
- unique Worker name and HTTPS control URL;
- its own RNGdle account email;
- its own Control password and migration token;
- its own secret file and migration credential file;
- its own backup destination;
- an explicit deployment target.

SMTP settings may be copied from the existing bot when desired, but account credentials and recipient addresses must be explicitly configured per profile. Secrets must never be committed, printed, or copied into Wrangler vars.

The CLI should support listing profiles, validating a profile, deploying a profile, checking its status, backing it up, and removing local profile configuration. Destructive Cloudflare resource deletion should not be automated by the initial version.

## Non-negotiable isolation checks

Before enabling deployment, tests must prove:
1. Profile configuration is validated and profile names are restricted to safe path/name characters.
2. Worker names and control URLs are unique and cannot resolve to the existing production Worker accidentally.
3. Generated Wrangler config retains the correct Durable Object class binding and migration declaration while producing a separate Worker namespace.
4. Every profile uses its own RNGDLE_EMAIL, CONTROL_PASSWORD, MIGRATION_TOKEN, and migration origin.
5. Secret values are excluded from generated plain vars and all console output.
6. Existing production config, secrets, local migration credentials, and the existing Worker's deployment target are never overwritten.
7. A failed build or deploy does not delete or modify the existing bot.
8. Backups are profile-specific and restore only into the explicitly selected target.

## Rollback plan

### Before deployment
- Close or abandon the pull request, or delete branch `feature/multi-bot-setup`.
- The default branch and existing production Worker remain unchanged.
- No Cloudflare resources or secrets are created by the development branch itself.

### After deploying a second bot
- Pause only the second bot using its own profile-specific management origin and migration token.
- Keep its backup and local profile files until the user confirms they are no longer needed.
- Remove or revert the second bot's deployment using its exact Worker name only after confirming the target. Do not delete the original Worker or its Durable Object namespace.
- If code changes are not wanted, revert the merge commit or revert the relevant PR. A code rollback does not automatically delete Cloudflare resources or restore Durable Object data.
- Never reuse the second bot's migration token, Control password, or profile files for the first bot.

## Release gates

- Implement and test on this branch only.
- Run the full unit test suite and browser tests.
- Review the generated config for both the existing bot and a sample second bot.
- Open a draft pull request for review.
- Do not merge, deploy, create production secrets, or alter Cloudflare resources without the user's explicit approval.
