# OpenStax Poker

Production: https://pokertracker-cfb7b.web.app

OpenStax Poker uses Firebase Hosting, Firestore, and Firebase Authentication. Anyone can view the ledger. The shared table editor is authenticated by Firebase; Firestore Security Rules restrict all writes to its designated UID. The passcode is not included in source or client bundles.

Each action is stored in a local retry queue before being committed in a Firestore transaction. Immutable operation IDs prevent retries from duplicating entries. Firestore subscriptions deliver live updates to other devices. Decentralized games record chips first and collect payment methods at final settlement.

## Develop and deploy

Requires Node 24.12 or newer. From `live/`, run `npm ci` once. From the repo root, run:

```sh
firebase login
firebase deploy
```

`firebase deploy` automatically builds the interface before uploading it. `firebase.json` and `.firebaserc` select the hosting output and project. Firebase web configuration and the editor UID are public identifiers; authentication tokens, passcodes, and financial backups must not be committed.

Type check with `npx tsc --noEmit`. Run accounting tests with `node --test tests/*.test.mjs`. The previous Cloudflare/Sites backend source remains for historical reference and migration rollback; Firebase is the current data source.

## Dashboard and game links

The home page summarizes all sessions, buy-in volume, results from completed games, and unpaid balances. Pending transfers remain unpaid until confirmed and reserve their amount in the suggested payment plan. Open pay-at-end sessions are excluded from collections. Closed games with unresolved chip discrepancies are flagged for review before their balances appear in the unpaid list.

Each session has a permanent URL at `/games/:id`, with `/activity` and `/settlements` tabs. `/games` lists every session. Sharing copies the current page URL. Firebase Hosting’s existing SPA rewrite supports opening or refreshing these links directly; the route selects the game from the shared ledger rather than browser-local selection state.

Settlements show per-player arithmetic, confirmed payments, and the exact sequence used to simplify transfers. All money is calculated in integer cents.

Run routing, analytics, and accounting checks from the repository root with `node --test live/tests/*.test.mjs tests/*.test.mjs`.

## Free email notifications

Player email addresses and opt-in flags live in editor-only `playerContacts` documents, never in the public ledger or its JSON/CSV exports. Adding or editing a player accepts a private email and an email-updates switch. Account updates write an immutable private `emailNotifications` record in the same Firestore transaction as the ledger operation. Operation IDs make command retries idempotent. Imports do not send historical email.

`email-sender/Code.gs` is a Google Apps Script sender using MailApp, with the required scopes in `email-sender/appsscript.json`. The deployed app serves both files under `/email-sender/`. The Firebase project owner must create the Apps Script project, paste these files, run `setup` once and authorize Google access, then deploy it as a web app executing as that owner with Anyone access. Settings → Email updates includes these steps and stores its `/exec` URL privately. This account must have IAM access to this Firebase project; the sender calls Firestore REST using its authorized Google OAuth identity.

The client requests delivery immediately after a committed operation; the web app verifies the caller’s Firebase ID token against the project’s editor UID before running. A one-minute Apps Script trigger also processes the queue while browsers are closed. No passcode, refresh token, service-account key, or email-service API secret is stored in the client. The sender checks the current contact before each send, honoring opt-outs and address changes.

Personal Apps Script accounts currently allow 100 email recipients/day for Gmail; quota exhaustion leaves notifications queued. A script lock prevents concurrent sends. Failed sends are marked failed; an interrupted send is left sending rather than automatically duplicated. MailApp has no idempotency key, so delivery cannot be guaranteed exactly once across a send/write crash. Verify these cases in the Apps Script execution log before manual recovery. The Settings delivery history distinguishes queued, sent, failed, canceled, and sending states. Running `setup` grants mail and database permissions; that Google consent cannot be completed through the Firebase CLI. No emails can be delivered until this one-time sender authorization is complete.

Official references: [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app), [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas), [Firestore REST authentication](https://firebase.google.com/docs/firestore/use-rest-api).

### Mailjet Free

The sender also supports Mailjet Free, currently 6,000 emails/month and 200/day without a credit card. Verify your sender in Mailjet, then set these values in Apps Script Project settings > Script properties:

- `EMAIL_PROVIDER`: `mailjet`
- `MAILJET_API_KEY`: your API key
- `MAILJET_SECRET_KEY`: your secret key
- `MAILJET_SENDER_EMAIL`: your verified sender email

The From name is OpenStax Poker. The API key and secret stay in Script properties and are never stored in Firestore or bundled in the website. Both provider options use the same authorized worker, queue, opt-out checks, and Firebase-authenticated immediate request. Run setup again and publish a new Apps Script deployment version after updating an existing worker. An existing Gmail worker is not silently migrated.

Mailjet attempts reserve a local daily/monthly budget before calling the provider. The worker never attempts more than 200 messages per UTC day or 6,000 per UTC month. Failed requests consume this local allowance conservatively. A provider quota/rate-limit response returns the message to pending. No code changes subscription plans or purchases credits. Keep the provider on its Free plan and do not add billing details. These counters apply to this worker; messages sent elsewhere from the same Mailjet account also consume the provider allowance. Do not clear the budget property or run multiple independent worker projects against the same allowance.

Official references: [Mailjet free limits](https://documentation.mailjet.com/hc/en-us/articles/19154256993051-Understanding-Mailjet-Free-Plan-Limits), [Mailjet API](https://dev.mailjet.com/docs/email-api/send-api-v31/send-basic-email).

The OpenStax Poker rename preserves existing storage keys, cookies, the sender mailbox, Firebase project identity, URLs, and saved game data. New emails and exported filenames use the new name.

## Interface

A dark card room. The Dashboard opens straight onto the table scene (`public/table-scene.jpg`) with the recorded players seated on its rail and a game information strip beneath it, Operations and a Settlement Snapshot beside it, and a buy-ins chart, current leader and recent games below. With no open game it shows the most recent one. The Dashboard and Live Session scale to the window from a 1672x941 design canvas and fit on one screen on desktop; phones get a single column. The background is `public/room-loop.mp4` with `room.jpg` as its still, cropped and blurred so it stays behind the panels; the header play/pause switch was moved to Settings. The royal intro restores the original gold-and-green room, with a gilded frame, crown, warm light sweep, and slow camera push. The perspective card deal and sequential flips remain. A slow reveal brings in the single gold “The table is yours” title, then the intro fades into the app automatically after 4.5 seconds; clicking or pressing a key skips ahead. Reduced-motion preferences skip the intro. All styles live in `app/globals.css`.

## Cash deposits, personal bankers, and cash-aware payouts

In a pay-at-end game, a buy-in can be marked Paid up front to another player using Cash, Coins, Venmo, Zelle, or Other. That player owes the payment onward, so the depositor owes nothing extra if they lose. A player can also have a personal banker, who settles for them: only the banker appears in the payment plan. Per game, a player can be marked cash only (paid only in cash), able to make change, and given an amount of cash on hand. The plan then pays cash-only players first from whoever holds cash, moves cash in whole $5 bills unless someone can make change, and flags any cash-only payout it cannot cover. Only received Cash deposits increase physical cash on hand; digital payments still credit the buyer and charge the recipient. Without any of these set, the plan is the plain largest-debt-to-largest-credit match. Settled payments stay listed with a check mark and can be undone.

## Player photos and large tables

Edit a player on the Players page to add a profile photo. It is cropped square, shrunk to a small JPEG in the browser, and stored on the player record in the shared ledger, so it syncs and is included in JSON backups (photos over about 60 KB are rejected). Up to 7 players sit in front of the table's chairs; with more, the eighth seat becomes a "+N more" plate showing the rest's combined net result (or buy-ins while they are still playing), and clicking it lists everyone at the table.

## Correcting and deleting records

Unlock editing with the existing passcode. On a game’s Activity tab, use Edit or Delete beside any buy-in, cash-out, or payment. Edits work in open and closed games; amounts, players, payment methods/status, cash holders, and notes can be corrected. Deleting removes the entry rather than voiding it. Totals and settlement plans recalculate while existing payments and adjustments remain recorded.

Games has Edit and Delete controls on every row; the game toolbar also has these controls. Edit changes the name, date, and notes. Deleting a game removes all its entries and adjustments after confirmation, while retaining the player directory and other games. Download a JSON backup first to retain a copy.

For advanced corrections, Settings → Database editor → Edit game JSON (also available inside Edit game) edits one complete game, including its entries, banking configuration, and adjustments. JSON amounts use integer cents. The game ID must stay unchanged; validation checks money, player references, payment statuses, and banker loops before saving. Imports still merge history; editing a game’s JSON replaces that game. Changes use the existing authenticated transaction and retry queue. If the record changed on another device since opening the editor, saving is rejected; reopen the editor to load the latest version.
