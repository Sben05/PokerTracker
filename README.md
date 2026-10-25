# Felt Club | Poker OS

Open the app: https://pokertracker-cfb7b.web.app

A classic casino ledger with public viewing, passcode-protected editing, automatic saves, and live updates between devices. Firebase Hosting serves the app; Firestore stores the ledger; Firebase Authentication and Firestore Security Rules protect edits.

The shared ledger is stored in the database, never in this source repository. Decentralized games record buy-ins as chips and settle net results at the end. Settings includes complete JSON backups and per-session CSV exports. Imports preserve existing history.

See [live/README.md](live/README.md) for development and deployment. To update the interface, edit the source and run `firebase deploy` from this directory; the deployment builds it automatically. Game data saves automatically without deployments or Git commits.

The earlier static app remains at `legacy.html` for exporting browser-local history. A backup of the pre-migration ledger is saved separately on the operator’s Desktop.
