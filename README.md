# Radio Meeting Scheduler

Radio Meeting Scheduler is a small scheduling helper for Umbrella Parade radio guest meetings and band studio rehearsals.

The Band and Radio tabs keep separate candidates, shared pages, messages, presets, and notes. Band rehearsals default to three hours, offer durations from one to ten hours, and remember the last selection. The initial band candidate range includes the planned studio date and the following six days; radio keeps the week before the broadcast.

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

The app stores its working data in the browser's localStorage. Existing radio data remains under `radio-meeting-scheduler:v1`; band data uses `band-meeting-scheduler:v1`. The selected tab uses `meeting-scheduler:active-mode`.

JSON export backs up the current tab, including its mode. Import restores the matching tab; older backups without a mode restore Radio. Export both tabs separately for a full backup or device transfer.

Band shared URLs include `&mode=band` and display the Umbrella Parade logo and rehearsal copy. Existing radio URLs keep the Sunopa header. No GAS redeployment is required.
