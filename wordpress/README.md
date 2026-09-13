# WordPress Plugin

The plugin bundles the scheduler and both logos. The WordPress page hosts the app in a same-origin iframe so theme styles cannot alter the controls. Shared links point back to the WordPress page, including installations with plain `?page_id=...` permalinks. Query forwarding runs in the browser to support cached pages.

## Build

```sh
npm run package:wordpress
```

The versioned ZIP is written under `releases/`. It contains only the plugin PHP, iframe integration assets, and the production Vite bundle. Existing archives are not overwritten; repeated builds get a timestamp suffix.

## Install

1. Upload the ZIP in WordPress > Plugins > Add Plugin > Upload Plugin.
2. Activate Umbrella Meeting Scheduler.
3. Open the new 日程調整 admin menu and create the public page.

The plugin does not create content on activation. The explicit page creation action publishes a full-width page without changing the site's home page or navigation menus. Existing pages are not overwritten.

For a custom page, add `[umbrella_meeting_scheduler]` in a Shortcode block and select the 日程調整ツール（全幅） page template. Optional `mode="radio"` changes the initial tab for browsers without a remembered selection.

## Storage and Backend

The current GAS API and CORS-compatible POST format are unchanged. Working settings remain in localStorage on the WordPress origin. Existing GitHub Pages settings must be exported per tab and imported on WordPress; they are not automatically read across origins. Existing guest links on GitHub remain usable.

The plugin does not store host admin keys in WordPress posts or publicly shipped files, and deactivation does not delete user data. No automatic data synchronization between browser profiles or sites is performed.

## Studio Settings

Band candidate dates use a Japanese multiple-selection calendar. The selected dates persist in the band workspace and JSON backup. Old backups derive the selection from existing candidate days. Adding or removing a date immediately updates the local candidates, preserving disabled or removed time slots on other selected days. The visible month's weekend shortcut adds Saturdays and Sundays without removing other selections. The radio date-range workflow is unchanged.

The settings tab stores a studio registry in the band workspace, including a name, website URL, and access/map URL. The band JSON backup includes this registry. Importing a legacy backup without a registry preserves the current registrations. Resetting a schedule also preserves the registry.

Selecting a studio copies its name and links into the schedule. Editing a selected registration updates the local schedule; deleting a registration preserves the current schedule's location and links. Existing shared pages change only when the host explicitly updates them. Studio links are included in the GAS memo and member message; guest pages safely link HTTP(S) addresses without a backend schema change.
