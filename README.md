# EVEMerc Desktop

Fleet-first EVE Online intelligence client built with Tauri 2, Svelte 5, TypeScript, and Tailwind CSS 4.

The Laravel backend remains the source of truth. This repository contains the Windows-first desktop client, local EVE log telemetry, offline cache, realtime fleet workspace, and modular intel UI.

## Development

```powershell
npm install
npm run check
npm run test
npm run tauri dev
```

See [PLAN.md](PLAN.md) for architecture, milestones, security boundaries, and acceptance criteria.

## Install on Windows

1. Download the latest `EVEMerc Desktop_*_x64-setup.exe` installer from the EVEMerc download page.
2. Close an older EVEMerc Desktop process before upgrading, then run the installer. Installation is per-user and does not require administrator access.
3. Windows SmartScreen may show an “unrecognized app” warning while v1 installers are unsigned. Check that the installer came from the EVEMerc site, choose **More info**, then **Run anyway**.
4. Start EVEMerc Desktop and choose **Log in with EVE**. Authentication happens in the system browser; the EVE password is never entered into the desktop app.

The first authenticated start downloads the current static-data snapshot. Fleet and map snapshots are cached for fast startup and are clearly marked historical when the server is unavailable.

## EVE log telemetry

The app discovers `%USERPROFILE%\Documents\EVE\logs` by default and tails both `Gamelogs` and `Chatlogs`. Existing files begin at EOF, so historical sessions are not replayed as live intel. A different logs root can be selected from the Operations panel.

`Gamelogs` are parsed locally into jump, docking, and combat observations, shown in the app's System Intel and Telemetry panels. `Chatlogs` are only tailed and counted by default — chat content is never read unless you explicitly add a channel to the **Intel Channels** allowlist in Operations settings, meant for structured alliance/corp intel-reporting channels (e.g. `gem.imperium`), not casual conversation.

Everything above stays local to the app. Only jump observations from characters using enabled tracking features are sent to the configured EVEMerc server — docking, combat data, and intel-channel chat are never transmitted anywhere.

## Known limitations

Two features are intentionally unavailable in this release because the backend doesn't expose the endpoints they need yet — see [PROGRESS.md](PROGRESS.md) gaps #4 and #7 for the full detail and current status:

- **Ship history** (M-tracking) — no backend read endpoint exists.
- **Routes / Route Finder** (M-navigation) — no backend read endpoint exists for `map-route-solarsystems`; create/update/delete exist but there's no way to list what's been created.

Both are tracked, not forgotten — they'll ship once the corresponding backend work lands.

## Build an installer

```powershell
npm ci
npm run check
npm test
npm run tauri build
```

The Windows NSIS installer is written beneath `src-tauri\target\release\bundle\nsis`. The MSI bundle is written beneath `src-tauri\target\release\bundle\msi` when WiX is available.
