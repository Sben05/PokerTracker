# PokerBank — The House Ledger

Open the live app: https://sben05.github.io/PokerTracker/

A classic casino ledger with automatic database saves, cross-device updates, and passcode-protected editing. Anyone can view the game. Decentralized tables record chips first and settle net results at the end.

The interface runs on GitHub Pages; a Cloudflare Workers API and D1 database persist the ledger. Every recorded action saves automatically, and open devices refresh every two seconds. Offline actions retry automatically; persistent action IDs and atomic revision checks prevent duplicate or overwritten buy-ins.

Source and development instructions are in [live/](live/README.md). Build the GitHub interface with `cd live && npx vite build --config vite.web.config.ts`, then copy `web-dist/` to the repository root. The original app is retained at [legacy.html](https://sben05.github.io/PokerTracker/legacy.html) so older browser-local games can be exported and imported into the new app.

Financial records and runtime secrets are not in this repository. JSON backups and session CSV exports are available in Settings.
