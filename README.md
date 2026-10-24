# PokerBank — poker night finance tracker

A finished, dependency-free static web app for informal poker-night accounting. Built for iPhone and desktop browsers. Runs with any basic static web server, including GitHub Pages.

## What it does

- Creates a permanent history of poker sessions, with a reusable player directory.
- Records buy-ins and rebuys, cash/coins/Zelle/Venmo/other payment methods, and whether money has actually arrived.
- Records chip cash-outs **separately from actual payouts**, including zero-dollar bust-outs.
- Calculates player profit/loss in exact integer cents, reconciles chips, and shows outstanding obligations.
- Suggests a small number of optimized direct transfers and remembers both pending and confirmed payments, including partial payouts.
- Supports documented equal splitting of a discrepancy (if the group agreed) or explicitly assigning the difference to the bank.
- Preserves voided transactions and supports session notes.
- Exports a complete JSON backup and Excel-compatible per-session CSV files.
- Automatically saves to a private JSONBin record after one-time connection on each trusted device; JSON and CSV downloads remain available.

## Publish on GitHub Pages

The Royal release is extracted directly into the root of `Sben05/PokerTracker`, preserving all source modules and tests. GitHub Pages publishes `main` → `/(root)` at https://sben05.github.io/PokerTracker/.

Keep Pages configured to **Deploy from a branch**, **main**, **/(root)**. Source and tests are public; financial records belong only on the operator's device or in a separate private data repository.

*GitHub Pages is a static website host, not a bank or a backend. Its Pages sites are typically public. The website must never contain your private ledger or API tokens.*

## Private online JSON (JSONBin)

The active app uses one private JSONBin record, with no PokerBank sign-in. The site stays on GitHub Pages. Financial records and API keys never belong in this public repository.

1. Create a **PRIVATE** JSONBin record containing `{"pokerbank":"uninitialized"}`. Copy the 24-character Bin ID.
2. Create an **access key** with **Bins Read** and **Bins Update** permission, scoped to the bin where supported. Do not use a master key. Revoke/rotate any key shared in a chat or elsewhere.
3. On the device containing your current ledger, open **Settings → Online JSON**. Enter the Bin ID and the new access key directly into the app.
4. Optionally select **Remember on this device** on trusted devices. This stores the key **unencrypted in browser local storage**. Otherwise the key is memory-only and must be reentered after refresh. **Disconnect & forget** removes the saved key; local ledger data remains.
5. Connect and confirm initializing the empty private record. The entire version-1 PokerBank ledger is saved as plain JSON. Wait for **Online JSON saved · up to date**.
6. On each other device, enter the same Bin ID and access key, connect, and confirm loading the online ledger. There are no credentials bundled in the website.

Local changes save immediately in the browser and debounce to the online JSON after about 1.7 seconds. Reopening with Remember enabled reconnects and loads newer remote records automatically if local data matches the last synchronized checkpoint. Unsaved local changes cause a pause instead of automatic replacement: export a backup before choosing **Load online**.

**Use one device at a time.** Before switching, wait for online save confirmation, then reopen or **Load online** on the next device. The app checks the current remote contents before writing and pauses when it detects a change. JSONBin's documented update API does not provide atomic compare-and-swap, so simultaneous writes can still race. There is no continuous remote polling. Network errors, revoked keys, public bins, and exhausted quotas pause online saving while preserving local data.

The free allowance is finite (10,000 requests, credited once) and records are limited to 100 KB. Each save uses a read plus an update. Export JSON backups regularly. JSONBin stores JSON only; CSV remains available through the app's download buttons. See https://jsonbin.io/pricing and https://jsonbin.io/api-reference/bins/update for provider limits.

The previous optional private GitHub JSON/CSV sync module and its tests are preserved in `github-sync.mjs`; the active UI now uses `jsonbin-sync.mjs` instead. It never connects to both providers simultaneously.

## Local development

To serve the files without GitHub Pages:

```bash
cd pokerbank_release
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

The site has no ads, analytics, third-party scripts, or external database. The active app only contacts JSONBin after the operator enters a Bin ID and access key, or opts in to remembering that connection. Do not use a public repository for financial records. `pokerbank-data.json` and `pokerbank-ledger.csv` must remain in the private repository. The CSV is Excel-compatible, not a native `.xlsx` workbook.

## Royal deployment verification

The automated sync tests use synthetic records only. They verify JSON/CSV writes, public-repository refusal, visibility rechecking before saves, and conflict handling. Live authenticated private JSONBin writes require the operator to connect their own private bin in Settings; no credentials ship with this site. The preserved optional GitHub module writes JSON and CSV in separate commits; the active JSONBin integration saves a single JSON record. Never change the data repository to public: the app checks visibility before saving, but changing visibility exposes existing history immediately.
