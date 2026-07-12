# Radio Meeting Scheduler

Radio Meeting Scheduler is a small scheduling helper for Umbrella Parade radio guest meetings.

It keeps the meeting workflow separate from Radio Article Studio:

- create meeting date candidates from a broadcast date
- choose candidate time slots
- copy text for Chouseisan
- copy a Codex task pack for creating the Chouseisan event
- copy a guest DM message
- store the Chouseisan URL, decided meeting time, and notes
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
