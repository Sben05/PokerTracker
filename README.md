# PokerBank — poker night finance tracker

A finished, dependency-free static web app for informal poker-night accounting. Built for iPhone and desktop browsers. Runs with any basic static web server, including GitHub Pages.

## Live rebuilt app

The new database-backed PokerBank is live at https://pokerbank-house-ledger.blithehake22.chatgpt.site. Anyone can view; editing is protected by a server-side passcode. Source is in [`live/`](live/README.md). Every action saves to D1, offline changes retry automatically, and open devices refresh every two seconds. The original static app below is retained for migration and historical reference.

## What it does

- Creates a permanent history of poker sessions, with a reusable player directory.
- Decentralized games record chips on credit and settle net results at the end. Buy-ins and new players require no payment method; choose one when recording a settlement. Existing received buy-ins and payments keep their accounting.
- Records buy-ins and rebuys, cash/coins/Zelle/Venmo/other payment methods, and whether money has actually arrived.
- Records chip cash-outs **separately from actual payouts**, including zero-dollar bust-outs.
- Calculates player profit/loss in exact integer cents, reconciles chips, and shows outstanding obligations.
- Suggests a small number of optimized direct transfers and remembers both pending and confirmed payments, including partial payouts.
- Supports documented equal splitting of a discrepancy (if the group agreed) or explicitly assigning the difference to the bank.
- Preserves voided transactions and supports session notes.
- Exports a complete JSON backup and Excel-compatible per-session CSV files.
- Can sync automatically to a **separate private GitHub repository** while the browser session is connected, writing both `pokerbank-data.json` (authoritative ledger) and `pokerbank-ledger.csv` (Excel-compatible transaction history).

## Publish on GitHub Pages

The Royal release is extracted directly into the root of `Sben05/PokerTracker`, preserving all source modules and tests. GitHub Pages publishes `main` → `/(root)` at https://sben05.github.io/PokerTracker/.

Keep Pages configured to **Deploy from a branch**, **main**, **/(root)**. Source and tests are public; financial records belong only on the operator's device or in a separate private data repository.

*GitHub Pages is a static website host, not a bank or a backend. Its Pages sites are typically public. The website must never contain your private ledger or API tokens.*

## Optional private GitHub ledger backup and sync

1. Create a **separate private** GitHub repository named, for example, `pokerbank-private-data`. Do not enable Pages for this repository.
2. Generate a **fine-grained personal access token**, restricted to this private repo only, with **Contents: Read and write**. Do not email or paste the token to someone else, and never commit it to source control.
3. Open the PokerBank website, navigate to **Settings**, and enter your GitHub username, the private repo name, and the token. The app checks that the repository is private before writing anything.
4. For an empty private repo, confirm that PokerBank may create `pokerbank-data.json`. If a ledger already exists, choose whether to upload this device’s ledger (the default) or load the remote ledger. Confirm before replacing either copy. Upload local records to back up a game entered while disconnected; load remote records when setting up another device. This replaces the selected destination, rather than merging ledgers.
5. After connection, local changes sync automatically after a short delay, updating both the JSON source of truth and the CSV spreadsheet mirror. Every page reports whether changes are local only, queued, saved remotely, or paused. A stale remote SHA or failed save pauses syncing to avoid silent overwrites.
6. **Refresh/reopen requires connecting again.** The token is deliberately memory-only; local browser data and owner/repo preferences are stored, but the token is never saved.

**Important limitations:** This is single-bank-operator software, not a real-time shared multi-editor database. Other devices can load the private ledger after authenticating, but overlapping edits require manual coordination. Export JSON backups after each game. Browser local storage is not encrypted, can be cleared, and is specific to the device/browser.

## Local development

To serve the files without GitHub Pages:

```bash
cd PokerTracker
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

To run tests:

```bash
node --test tests/*.test.mjs
```

## Financial safety and accuracy

- Buy-in transactions reflect chips issued. `Received` must only be checked when funds are actually verified.
- A cash-out reflects the **value of chips surrendered**, not proof that a payout was sent.
- Settlement suggestions **never send money**. Payments must be separately recorded and marked paid when verified.
- Amounts are stored in integer cents, never floating point dollars.
- Outstanding debts reflect both a player's chip entitlements and their uncollected buy-ins, plus prior confirmed and pending transfers.
- A balanced ledger does not prove that physical cash, coins, or chips are accurate. Always count those separately.
- Avoid automatically applying equal-loss allocations without an agreed-upon group policy.
- GitHub synchronization is an optional personal backup path and is not suitable for high-concurrency collaborative editing.

## Data privacy

The site has no ads, analytics, third-party scripts, or external database. It only contacts GitHub's API after the operator voluntarily enters private-repo credentials. Do not use a public repository for financial records. `pokerbank-data.json` and `pokerbank-ledger.csv` must remain in the private repository. The CSV is Excel-compatible, not a native `.xlsx` workbook.

## Royal deployment verification

The automated sync tests use synthetic records only. They verify JSON/CSV writes, public-repository refusal, visibility rechecking before saves, and conflict handling. Live authenticated private writes require the operator to connect their own private repository in Settings; no credentials ship with this site. JSON and CSV are separate GitHub commits, so a CSV failure can leave JSON newer; reconnect to reload the authoritative JSON and sync again. Never change the data repository to public: the app checks visibility before saving, but changing visibility exposes existing history immediately.
