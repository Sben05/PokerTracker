# PokerBank Live

The rebuilt PokerBank app saves each action directly to Cloudflare D1. Anyone can view the ledger; edits require the configured server-side passcode. Editor sessions use signed, expiring tokens; the same-origin app also uses an HttpOnly cookie. The GitHub Pages interface stores its editor token in browser storage so it works without third-party cookies. No passcode or signing secret is included in browser bundles or source.

- Automatic database saves, a durable per-action offline queue, and cross-device refresh every two seconds.
- Atomic revision checks and persistent command IDs prevent concurrent updates from overwriting each other and retries from duplicating buy-ins.
- Decentralized games default to pay-at-end. Payment methods are collected at settlement.
- Imports merge missing sessions and reuse matching player names. Existing sessions keep their history.
- Complete JSON exports, per-session CSV, audit-preserving corrections, and discrepancy allocation.

## Development

Requires Node 22.13 or newer. Install with the Sites plugin dependency helper, then `npm run dev`.

Production configuration lives in `.openai/hosting.json`. Runtime secrets `EDIT_PASSCODE` and `SESSION_SECRET` are configured through Sites. Do not add their values to source. The database binding is `DB`; generated SQL migrations live in `drizzle/`.

Build: `npm run build`. Type check: `npx tsc --noEmit`. Tests: `node --test tests/*.test.mjs`.

For a local built preview, apply migrations to the local database as described by the Sites starter, then run `npm start`. Local test values can be passed with Wrangler's `--var` flags. Local databases and caches are ignored and never included in deployment archives.

The original static app remains in the parent directory for migration. Export JSON from it and import that backup into this app. Financial data belongs in the runtime database or local backups, not this source repository.

## GitHub Pages interface

The public interface is hosted at https://sben05.github.io/PokerTracker/. Build it with `npx vite build --config vite.web.config.ts`, then publish the files in `web-dist/` at the repository root. The Sites Worker remains the durable API backend. CORS permits this GitHub origin; every write still requires a signed editor token. The ledger and passcode are never bundled with the interface.
