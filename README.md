# Radio Meeting Scheduler

Radio Meeting Scheduler is a small scheduling helper for Umbrella Parade radio guest meetings.

It keeps the meeting workflow separate from Radio Article Studio:

- create meeting date candidates from a broadcast date
- choose candidate time slots
- create a self-hosted scheduling page: guests open a shared URL (`?e=EVENT_ID`)
  and answer with ○△× — answers are stored via a Google Apps Script backend
  (see [gas/README.md](gas/README.md) for setup)
- view everyone's answers in a summary table and decide the meeting time
- edit and copy a guest DM message
- insert reusable text blocks into the DM
- save custom DM presets
- copy candidate times and a Codex task pack
- store the decided meeting time and notes
- export/import a local JSON backup

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages

This app is configured for:

```text
https://umbrellaparade.github.io/Radio-Meeting-Scheduler/
```

## Local Data

The app stores its working data in the browser's localStorage. Use JSON export/import for backup or device transfer.
