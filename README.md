# Ember & Echo

A D&D campaign management tool for creating and running a local campaign without logging in or paying for a backend.

## Features

- Create a campaign by name without an account
- Pick a save folder on the computer at the start
- Auto-save the current campaign locally
- Manual save button for instant backup
- Character sheet creation with class, level, stats, notes, and portrait upload
- Default generated portrait fallback when no image is uploaded
- Battle map upload flow with grid-based placement for party members
- World map upload flow with clickable location pins
- Export/import campaign files as JSON backups

## How saving works

At startup, the app asks the user to choose a folder on the computer where the campaign file should be saved.

- If the browser supports the File System Access API, the app writes the current campaign directly to that folder.
- The app also keeps the campaign in browser local storage as a fallback.
- You can export a campaign file at any time for manual backup or transfer.

## Run it locally

Use Node 22 or newer for the Vite toolchain.

```bash
npx --yes -p node@22 node ./node_modules/vite/bin/vite.js --host 0.0.0.0
```

Then open the local URL shown in the terminal, usually:

```text
http://localhost:5173/
```

## Production build

```bash
npx --yes -p node@22 node ./node_modules/vite/bin/vite.js build
```

## Local storage model

This project is intentionally local-first and has no cloud dependency. Campaigns are saved on the user’s device and can be exported and reimported as JSON files.
