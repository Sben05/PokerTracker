# PokerBank Live — Firebase edition

Production: https://pokertracker-cfb7b.web.app

PokerBank uses Firebase Hosting, Firestore, and Firebase Authentication. Anyone can view the ledger. The shared table editor is authenticated by Firebase; Firestore Security Rules restrict all writes to its designated UID. The passcode is not included in source or client bundles.

Each action is stored in a local retry queue before being committed in a Firestore transaction. Immutable operation IDs prevent retries from duplicating entries. Firestore subscriptions deliver live updates to other devices. Decentralized games record chips first and collect payment methods at final settlement.

## Develop and deploy

Requires Node 24.12 or newer. From `live/`, run `npm ci` once. From the repo root, run:

```sh
firebase login
firebase deploy
```

`firebase deploy` automatically builds the interface before uploading it. `firebase.json` and `.firebaserc` select the hosting output and project. Firebase web configuration and the editor UID are public identifiers; authentication tokens, passcodes, and financial backups must not be committed.

Type check with `npx tsc --noEmit`. Run accounting tests with `node --test tests/*.test.mjs`. The previous Cloudflare/Sites backend source remains for historical reference and migration rollback; Firebase is the current data source.
