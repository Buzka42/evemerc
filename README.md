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

Raw chat and combat lines remain local. Only normalized location observations required by enabled features are sent to the configured EVEMerc server.

## Build an installer

```powershell
npm ci
npm run check
npm test
npm run tauri build
```

The Windows NSIS installer is written beneath `src-tauri\target\release\bundle\nsis`. The MSI bundle is written beneath `src-tauri\target\release\bundle\msi` when WiX is available.
