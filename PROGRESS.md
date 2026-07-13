# EVEMerc Desktop — Progress & Handoff

> Read this before touching code. It records what exists, what was verified working, and what
> the next session should do first. Update this file whenever a milestone-sized chunk of work
> lands — it is the continuity mechanism between sessions/implementers. See [PLAN.md](PLAN.md)
> for the full architecture spec this progress is measured against.

Last updated: 2026-07-13, by a Claude Code session that pushed the initial scaffold to
[github.com/Buzka42/evemerc](https://github.com/Buzka42/evemerc), ran graphify
(`graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.html`), and did a first correctness pass.

## Verified working right now

```
npm test         # 45/45 tests pass (28 files)
npm run check    # svelte-check: 0 errors, 0 warnings
cargo check       # (src-tauri) clean
cargo clippy      # (src-tauri) clean, no warnings
```

Nothing here is aspirational — all four were re-run and confirmed clean as of this update.
`npm run tauri dev` / `npm run tauri build` have **not** been exercised in this session (no
Tauri runtime available in this environment) — treat that as unverified.

## What is actually implemented

This is far along relative to PLAN.md's M0–M3 milestones. Rough map:

- **Rust core** (`src-tauri/src/`): auth commands (loopback listener + keyring), window
  management commands (popout panels, always-on-top), SDE snapshot sync, offline cache
  (`cache.sqlite`-equivalent via `cache.rs`), and a full EVE log pipeline
  (`eve_logs/{discovery,tailer,decoder,parser}.rs`) with byte-offset persistence, BOM-aware
  decoding, and Gamelogs/Chatlogs separation. `lib.rs` wires all of it into the Tauri app.
- **Auth**: PKCE flow (`lib/auth/{pkce,flow}.ts`) with deep-link + loopback fallback, token
  storage via `MemoryAccessTokenStore`/keyring bridge, server-URL switching.
- **API client**: `lib/api/client.ts` wraps `openapi-fetch` against a real
  `lib/api/openapi.yaml` (already vendored — not a stub) with 401 handling.
- **Realtime**: `lib/realtime/echo.ts` connects Reverb, dispatches fleet member / server status
  / chain-invalidation events; `App.svelte`'s `ensureRealtime()` wires it to the UI state.
- **Fleet command**: registration, waypoints, commanders (`lib/fleet/actions.ts`), freshness
  scoring (`lib/fleet/freshness.ts`), alerting (`lib/fleet/alerts.ts`), snapshot reconciliation
  with revision ordering (`lib/fleet/status.ts`), and local-jump/ESI fusion
  (`lib/fleet/localJump.ts`, `lib/telemetry/fusion.ts`).
- **Regional map**: `lib/regional/{model,RegionMap.svelte}` renders live fleet positions over
  SDE topology; kill-activity overlay via the `reference-intel` module
  (`lib/modules/reference-intel/provider.ts`).
- **Wormhole chain map**: `lib/wormhole/{api,types,signatureParser,WormholeChain.svelte}` —
  full CRUD (add/move/connect systems), probe-scanner paste parsing, EVE-Scout import, saved
  locations, map statistics.
- **Local EVE telemetry**: `lib/telemetry/{eveLogs,fusion,observations,publisher}.ts` bridges
  Rust-emitted observations into fleet state and publishes normalized location observations to
  the backend.
- **Module registry**: `lib/modules/registry.ts` (`ModuleRegistry` class) + 5 registered
  modules: `fleet`, `local-telemetry`, `regional`, `reference-intel`, `wormhole-map`
  (`lib/modules/index.ts`).
- **Layout**: `lib/layout/{dock,profiles,windows,panelBridge}.ts` — dockview-backed workspace,
  3 built-in layout profiles, popout panel windows with a cross-window state bridge
  (`PanelWindow.svelte`).
- **Everything else PLAN.md §11 lists as a module** is present as *inline logic in `App.svelte`*
  rather than a registered `FeatureModule`: map switching/settings, signatures, routing/ignore
  list, EVE-Scout import, saved locations, audits, account/tokens, killfeed, system intel,
  command palette, release-check banner. See the gap below — this matters.

Almost everything above has a co-located `*.test.ts` and the tests are real (they exercise
actual logic, not snapshot-only). `App.svelte` is one large file (~1300 lines) that owns all UI
state as flat `$state` variables and orchestrates every feature inline.

## Known gaps (found this session, not yet fixed)

Ordered by how much they matter for PLAN.md's stated design goals.

### 1. The module registry doesn't actually drive the dock (biggest gap)

PLAN.md §10.1's whole point is "disabling a module removes its panels from all layouts." Today:

- `lib/layout/profiles.ts` hardcodes `PanelId = 'fleet-command' | 'wormhole-chain' | 'account' |
  'telemetry'` — four fixed panels.
- `lib/layout/dock.ts`'s `createDockWorkspace` reads DOM elements tagged
  `data-dock-panel="..."` directly out of a static template in `App.svelte` — it never calls
  `moduleRegistry.panels()`.
- `ModuleRegistry.panels()` / `.regionalLayers()` / `.commands()` exist and are tested
  (`registry.test.ts`), but only `regionalLayers()` and (indirectly) module enable/disable
  gating in `App.svelte`'s `toggleModule()` are actually consumed. `panels()` has no caller in
  `App.svelte` at all.
- Net effect: toggling a module in the Settings panel changes `moduleRegistry.isEnabled()` and
  refreshes regional-layer data, but it cannot add or remove a dock panel, because dock panels
  aren't sourced from modules.

**To fix properly**: `PanelDefinition` in `lib/modules/types.ts` already has the right shape
(`id`, `title`, `component`, `defaultPlacement`, `popoutable`). The work is: (a) make
`createDockWorkspace` accept `PanelDefinition[]` instead of reading `data-dock-panel` elements,
using `component()` to mount panels via Svelte's `mount()`/`unmount()` (see PLAN.md §10.2's
"thin adapter" note); (b) convert the four hardcoded panels plus the inline
signatures/routing/audits/account/killfeed/system-intel blocks in `App.svelte` into panel
components owned by their own modules; (c) make `LayoutProfile.panels` reference module panel
ids generically instead of the closed `PanelId` union. This is a real refactor, not a small
patch — budget it as its own milestone slice, and do it with the dockview spike risk noted in
PLAN.md §17.2 in mind (approved fallback: `golden-layout` v2 if dockview-core fights back).

### 2. EVE log parser only recognizes one template

`src-tauri/src/eve_logs/parser.rs` implements exactly one `EveLogObservationKind`:
`JumpStarted`, matched by one regex for the English "Jumping from X to Y" gamelog line.
PLAN.md §9.4 calls for `jump_started`, `location_confirmed`, `combat_hit`, `combat_miss`,
`warp`, and `session_started`.

**Do not just add regexes for these from memory.** PLAN.md §17.10 and the testing strategy
(§15 "Rust log fixtures") are explicit that new templates must be matched against sanitized
real EVE gamelog fixtures, tested for locale variants, and must degrade to an "unknown
template" diagnostic rather than guess — this is a stated privacy/correctness risk, not a
style preference. Before extending this file: obtain real (sanitized) `Gamelogs`/`Chatlogs`
samples for the templates you intend to support, add them as test fixtures, then extend
`EveLogObservationKind` and `parse_line`. Combat parsing in particular has HTML-ish markup
that varies by client version — verify against a current-client sample, not old documentation.

### 3. `Chatlogs` are tailed but never parsed

`eve_logs/mod.rs`'s `process_chat_path` calls `read_complete_lines` and only counts them
(`chat_lines_read`). This matches PLAN.md's requirement that chat is opt-in per channel and not
yet a location source, but there is currently no channel-allowlist mechanism at all — any
chatlog file is tailed and counted, with no per-channel enable/disable and no parsing into any
structure. This is fine for now (nothing sensitive leaves the tailer since nothing is emitted),
but it means the "Chatlogs" feature described in PLAN.md §9.4 is stubbed, not partially built —
don't assume any chat-derived intel exists yet.

### 4. `openapi.yaml` may be stale relative to a real backend

`scripts/sync-api.ts` exists and expects a running/reachable EveMerc backend to regenerate
`src/lib/api/openapi.yaml` and `schema.d.ts` from live Scribe output. This session did not run
it (no backend available) and does not know whether the backend's `api/v1` routes described in
the main repo's `DESKTOP_REBUILD_PLAN.md` Appendix A actually exist yet on the server this app
points to by default (`https://wormhole.systems`). If backend endpoints are added or changed,
re-run `npm run sync:api` before trusting `schema.d.ts`.

### 5. `App.svelte` size

At ~1300 lines with ~50 top-level `$state` variables, it is past the point where a human or
model can safely reason about it in one read. Not urgent to fix in isolation, but gap #1's
refactor is the natural moment to also split state ownership per-module (each module owning its
own `$state`, exposed through `ModuleCtx` per PLAN.md §10.1) rather than doing a cosmetic split.

## Fixed this session

- `App.svelte` `selectLayout()` called `dockWorkspace?.applyProfile(profile)` twice in a row
  (harmless but dead duplicate call) — removed the duplicate.

## Recommended order for the next session

1. **Read this file and `graphify-out/GRAPH_REPORT.md`** before making changes — the report's
   "Suggested Questions" section flags real ambiguous edges worth a second look (e.g. whether
   `parseProbeScanner()`'s inferred connections to `pasteSignatures()`/`getSignatureCatalog()`
   are structurally sound).
2. If backend `api/v1` work has landed in the main `EveMerc` repo since this was written, run
   `npm run sync:api` first and re-run `npm run check` to catch any type drift.
3. Tackle gap #1 (module-driven dock) as its own scoped piece of work — it's the highest-value
   fix because it's what makes "user chooses which features he sees" actually true, which is a
   stated non-negotiable goal for this rebuild.
4. Only touch gap #2 (log parser templates) once real gamelog fixtures are available; add them
   under a `src-tauri/src/eve_logs/fixtures/` (or similar) directory and write the property/fuzz
   tests PLAN.md §15 calls for alongside the new templates.
5. Keep `npm test`, `npm run check`, `cargo check`, and `cargo clippy` green after every change,
   and update this file's "Verified working right now" / "Known gaps" sections before ending the
   session — do not let this document drift out of sync with the code.

## Where things live

- Architecture spec: [PLAN.md](PLAN.md)
- Install/build/dev instructions: [README.md](README.md)
- Codebase map (auto-generated, regenerate with `/graphify` after significant changes):
  `graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.html`
- This file: update it, don't replace it wholesale — keep the "Fixed this session" history if
  useful, but collapse old entries once they're stale so it stays skimmable.
