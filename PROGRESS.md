# EVEMerc Desktop — Progress & Handoff

> Read this before touching code. It records what exists, what was verified working, and what
> the next session should do first. Update this file whenever a milestone-sized chunk of work
> lands — it is the continuity mechanism between sessions/implementers. See [PLAN.md](PLAN.md)
> for the full architecture spec this progress is measured against.

Last updated: 2026-07-13, by a Claude Code session that pushed the initial scaffold to
[github.com/Buzka42/evemerc](https://github.com/Buzka42/evemerc), ran graphify
(`graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.html`), did a first correctness pass,
partially closed gap #1 (module-driven dock: module-gating logic, 12 presentational component
extractions out of `App.svelte`, and finally making `account` a real dock panel — see "Fixed
this session" below).

## Verified working right now

```
npm test         # 51/51 tests pass (29 files)
npm run check    # svelte-check: 0 errors, 0 warnings
npm run build    # vite build succeeds; main JS bundle 496 KB / 131 KB gzipped
cargo check       # (src-tauri) clean
cargo clippy      # (src-tauri) clean, no warnings
cargo test        # (src-tauri) 27/27 tests pass
```

Nothing here is aspirational — all six were re-run and confirmed clean as of this update. The
131 KB gzipped bundle is comfortably under PLAN.md §13's <400 KB initial-bundle budget.
`npm run tauri dev` / `npm run tauri build` have **not** been exercised in this session (no
Tauri runtime available in this environment) — treat those as unverified. `vite build` only
proves the web bundle compiles; it does not prove the Tauri shell, IPC commands, or any native
window behavior work.

## What is actually implemented

This is far along relative to PLAN.md's M0–M3 milestones. Rough map:

- **Rust core** (`src-tauri/src/`): auth commands (loopback listener + keyring), window
  management commands (popout panels, always-on-top), SDE snapshot sync, offline cache
  (`cache.sqlite`-equivalent via `cache.rs`), and a full EVE log pipeline
  (`eve_logs/{discovery,tailer,decoder,parser,offsets}.rs`) with cross-restart byte-offset
  persistence (added this session — see "Fixed this session"), BOM-aware decoding, and
  Gamelogs/Chatlogs separation. `lib.rs` wires all of it into the Tauri app.
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
  list, EVE-Scout import, saved locations, audits, killfeed, system intel, command palette,
  release-check banner. (Account/tokens is the one exception — it's now a real, independently
  toggleable dock panel, just not yet owned by a `FeatureModule`.) See gap #1 below — this
  matters.

Almost everything above has a co-located `*.test.ts` and the tests are real (they exercise
actual logic, not snapshot-only). `App.svelte` owns all cross-cutting UI state as flat `$state`
variables and orchestrates every feature inline, but its *markup* is no longer monolithic — see
"Fixed this session" for the presentational components pulled out of it. Components with
dedicated tests still follow the codebase convention of testing pure logic modules, not the
`.svelte` files themselves (no `*.svelte.test.ts` files exist anywhere, including for the
pre-existing `RegionMap.svelte`/`WormholeChain.svelte`) — this is consistent, not an oversight.

## Known gaps (found this session, not yet fixed)

Ordered by how much they matter for PLAN.md's stated design goals.

### 1. The module registry doesn't actually drive the dock (biggest gap — partially closed)

PLAN.md §10.1's whole point is "disabling a module removes its panels from all layouts."

**What this session fixed**: `lib/layout/profiles.ts` now exports `panelModuleOwners` (a
`PanelId -> moduleId | null` map) and `resolveVisiblePanels(profile, isModuleEnabled)`, a pure
function that intersects profile visibility with module enablement. `lib/layout/dock.ts`'s
`createDockWorkspace` takes a new `isModuleEnabled` callback and uses `resolveVisiblePanels`
both when building a fresh layout and when restoring a saved one from `localStorage` — a saved
layout can no longer resurrect a panel whose owning module has since been disabled (it's
actively removed via `api.removePanel`). `App.svelte` now passes
`(moduleId) => moduleRegistry.isEnabled(moduleId)` into `createDockWorkspace`. Covered by 4 new
tests in `lib/layout/profiles.test.ts`. Today `wormhole-chain` is the only panel with a real
owning module (`wormhole-map`); `fleet-command` maps to the `fleet` core module (always
enabled); `account` and `telemetry` are shell chrome with no owner (`null`), so they're
unaffected by module toggling — see the next paragraph for why.

**What's still NOT fixed** — this only closes the "module state gates a panel" half of the gap,
not the "panels come from modules" half:

- `lib/layout/profiles.ts` still hardcodes `PanelId = 'fleet-command' | 'wormhole-chain' |
  'account' | 'telemetry'` — four fixed panels, a closed union.
- `lib/layout/dock.ts` still reads DOM elements tagged `data-dock-panel="..."` out of a static
  template in `App.svelte` — it never calls `moduleRegistry.panels()`. `PanelDefinition` objects
  (with `component: () => Promise<...>`) are still never consumed anywhere.
- It's not just `panels()`: `ModuleRegistry.fleetWidgets()`, `.intelProviders()`, and
  `.commands()` are all implemented and covered by `registry.test.ts`, but **zero** modules
  populate `fleetWidgets`/`intelProviders`/`commands` today (only `reference-intel` populates
  `regionalLayers`, which is the one contribution type that IS consumed, via
  `moduleRegistry.regionalLayers()` in `App.svelte`), and nothing in `App.svelte` or
  `PanelWindow.svelte` calls `.fleetWidgets()`, `.intelProviders()`, or `.commands()` at all — the
  command palette's `filterPaletteCommands` works off the static `paletteCommands` array in
  `lib/commands/palette.ts`, not the registry. Keep this in mind before assuming any extension
  point beyond `regionalLayers` is load-bearing.
- The signatures/routing/audits/killfeed/system-intel *sections* still aren't panels at all —
  they're now standalone `.svelte` components (see "Fixed this session"), but they're still
  mounted inline inside the `fleet-command` and `telemetry` dock panels, so they can't be
  independently toggled, popped out, or owned by a module yet. Extracting them into components
  was a prerequisite step, not the fix itself — the remaining work is wiring
  `moduleRegistry.panels()` to actually place them as their own dock panels. (`account` used to
  be in this list too — see below, it's fixed now.)
- **`account` is now a real dock panel in the main window** (was a phantom — see the entry two
  bullets up in an earlier version of this file if you need the archaeology). It uses the exact
  same `ExistingElementRenderer` DOM-move mechanism already proven for `fleet-command`/
  `telemetry`/`wormhole-chain` — `AccountPanel.svelte` now lives in its own top-level
  `<aside data-dock-panel="account">` in `App.svelte` (previously nested inside `telemetry`,
  gated only by a template `{#if}`), and `dock.ts`'s `loadProfile` calls
  `addPanel('account', { referencePanel: 'fleet-command', direction: 'right' })` when
  `resolveVisiblePanels` includes it. Deliberately did **not** attempt the harder half of this
  gap (Svelte-`mount()`-based dynamic panels with live-reactive props) in the same pass — that
  needs real browser verification of Svelte 5's prop-reactivity-through-`mount()` semantics,
  which isn't available in this environment, so it stayed out of scope.
  `PanelWindow.svelte`'s popout branch for `account` now shows a **read-only** character list
  (`PanelWindowState` gained an `accountCharacters` field, published from `App.svelte`'s existing
  debounced `schedulePanelStatePublish()` — added to both the publish call and the `$effect`'s
  dependency-tracking block, matching exactly how `fleet-command`'s popout already shows a
  read-only `RegionMap` and `wormhole-chain`'s shows a read-only `WormholeChain`). It intentionally
  has no action buttons (refresh/prefer/revoke/issue-token) — wiring those would require the
  cross-window action-dispatch mechanism PLAN.md §10.4 describes ("mutations from popouts are
  forwarded to the main window"), which doesn't exist yet for any popout, not just this one; out
  of scope for this fix, and account tokens are deliberately NOT included in the synced state
  (no reason to mirror token metadata into a second window).

**To fully fix**: make `createDockWorkspace` accept `PanelDefinition[]` instead of reading
`data-dock-panel` elements, using `component()` to mount panels via Svelte's
`mount()`/`unmount()` (see PLAN.md §10.2's "thin adapter" note); split those inline blocks into
real panel components owned by their own modules; make `LayoutProfile.panels` reference module
panel ids generically instead of the closed `PanelId` union. This is a real refactor, not a
small patch — budget it as its own milestone slice, and do it with the dockview spike risk noted
in PLAN.md §17.2 in mind (approved fallback: `golden-layout` v2 if dockview-core fights back).
The module-gating plumbing landed this session (`panelModuleOwners`, `resolveVisiblePanels`)
should carry over directly — extend `panelModuleOwners` as new panels get real owners instead of
inventing a second mechanism.

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

**Update, same day, later session:** checked `C:\Users\Arawn\FZ\EveMerc` (the backend repo,
read-only — did not modify anything there) and found `routes/api.php` now has a substantial,
**uncommitted** `api/v1` implementation (`AccountController`, `DesktopAuthController`,
`FleetStatusController`, `LocationObservationController`, `SdeSnapshotController`,
`RealtimeConfigController`, etc.) that closely matches Appendix A, plus matching migrations and
several `tests/Feature/*`/`tests/Unit/*` files. It also has a handful of stray untracked scratch
files (`test.js`, `newLayout.js`, `decoded_layout.json`, a file literally named `toArray())`)
suggesting active, possibly messy, in-progress work of unknown provenance and readiness. **Did
not** start the backend server, run `scribe:generate`, or run `npm run sync:api` against it —
this is someone else's uncommitted work in a different repo with no context on whether it's
stable, so touching it (or trusting it enough to sync against it) needs the project owner's
go-ahead first, not an assumption. One concrete mismatch spotted just from reading the route
file: the backend's fleet-status route is `maps/{map}/fleet/status` (Laravel route parameter
named `map`), while the desktop's `lib/fleet/status.ts` calls
`/api/v1/maps/{map_slug}/fleet/status` (expects a `map_slug` path parameter) — if Scribe
generates the OpenAPI spec from the literal route pattern, that parameter-name mismatch alone
would make a straight `npm run sync:api` regenerate a client that doesn't match hand-written call
sites like this one. Don't assume `sync:api` is a mechanical no-think step once the backend is
ready — expect to reconcile naming mismatches like this one by hand.

### 5. `App.svelte` size (much improved this session, not resolved)

Started at ~1323 lines with ~50 top-level `$state` variables. This session extracted 12
presentational components (see "Fixed this session") and split the `account` section into its
own top-level dock panel, netting out at ~1138 lines (the account/telemetry popout wiring added
a few lines back). The remaining size is orchestration: auth flow, map/fleet/chain data loading,
realtime wiring, and the dock host itself — all cross-cutting, so it doesn't decompose the same
way the display blocks did. Gap #1's refactor is still the natural moment to also split *state
ownership* per-module (each module owning its own `$state`, exposed through `ModuleCtx` per
PLAN.md §10.1) rather than continuing to peel off presentational leaves.

### 6. M-maps "General"/"Access" settings: blocked by an undocumented backend contract

Home system, rally point, and the access ACL are missing not from unwillingness to build them
but because the vendored OpenAPI contract doesn't document enough to build them correctly.

PLAN.md §11's M-maps module calls for a "Map Settings" dialog covering General (rename, delete,
toggle public, share tokens — rename/delete were missing and are now fixed, see "Fixed this
session"), **Access** (ACL for characters/corps/alliances with expiry), and **Home System** /
**Rally Point**. Checked `src/lib/api/schema.d.ts` (the vendored OpenAPI contract) for all three:

- `POST /api/v1/maps/{map_slug}/settings/home-system` (body: `{ map_solarsystem_id }`) and
  `POST .../settings/rally-point` (body: `{ solarsystem_id }` — note the two endpoints use
  *different* id semantics, map-solarsystem vs. raw solarsystem, which is presumably correct on
  the backend's side but easy to get backwards if built from memory instead of the schema) both
  exist and are write-only in the schema — grepping the entire schema for `home_system` /
  `rally_point` / `homeSystem` / `rallyPoint` finds **zero** matches anywhere in a map's GET
  response. There is currently no documented way to read back which system is set as home/rally,
  which means a "set home system" UI would have no way to show its own current state — it would
  set blind and never confirm. Did not build it; guessing a field name for the read side would be
  exactly the kind of unverifiable assumption this project has been avoiding all session.
- `GET /api/v1/maps/{map_slug}/access` is present in the schema but its 200-response body is
  **entirely undocumented** — the operation's `responses` only documents the 401 error case, not
  what a successful access-list response contains. `POST` (grant access) has a fully documented
  request body (`entity_id`, `entity_type: character|corporation|alliance`, `permission`,
  `expires_at`), but there is no companion `DELETE` in the schema at all — visible routes cover
  view + grant, not revoke. Building an Access UI now would mean guessing the list-item shape.

Both are one-way blocked by the *documentation*, not the *feature* — if `npm run sync:api` is
re-run later against a backend where Scribe has fully documented these responses (and a revoke
endpoint exists for access), building this becomes exactly as straightforward as rename/delete
was this session: check the schema, write a thin wrapper in `lib/maps/settings.ts`, wire it into
`MapRoutingPanel.svelte` (or a dedicated component, if the panel is getting overloaded — see the
naming note in "Fixed this session"). Don't build a placeholder/guessed version in the meantime.

## Fixed this session

- `App.svelte` `selectLayout()` called `dockWorkspace?.applyProfile(profile)` twice in a row
  (harmless but dead duplicate call) — removed the duplicate.
- Dock panel visibility now respects module enablement, not just profile visibility (see gap #1
  above for the full detail). `wormhole-chain` correctly disappears from every layout when the
  `wormhole-map` module is disabled, including on restore from a saved dockview layout.
- Extracted 12 presentational components out of `App.svelte`'s inline markup (1323 → 1124 lines),
  each taking props/callbacks rather than reaching into shared state directly (same pattern as
  the pre-existing `RegionMap.svelte`/`WormholeChain.svelte`): `AccountPanel.svelte`,
  `TelemetryStatus.svelte`, `SelectedSystemIntel.svelte`, `MapRoutingPanel.svelte`,
  `FleetKillfeed.svelte`, `FleetCommanders.svelte`, `FleetAlertsPanel.svelte`,
  `FleetMemberList.svelte`, `FleetCommandActions.svelte`, `SavedLocationsPanel.svelte`,
  `MapActivityLog.svelte`, `ChainEditToolbar.svelte`. `svelte-check` and the full test suite were
  re-run clean after every single extraction, not just at the end. This is groundwork for gap #1's
  full fix, not the fix itself — see gap #1 for what's still needed on top of this.
- Wired `account` up as a real, independently-toggleable dock panel using the same DOM-move
  renderer as the other three panels — see gap #1's sub-bullet for the full detail on scope and
  what's still out (Svelte-`mount()`-based dynamic panels, which is a separate, harder question).
- `PanelWindow.svelte`'s `account` and `telemetry` popouts now show real read-only content
  instead of the generic "stays synchronized" placeholder. `account` reads `accountCharacters`
  from the existing `PanelWindowState` cross-window bridge (new field, published alongside the
  fleet/chain/regional data it already carried). `telemetry` didn't need that bridge at all —
  `getEveLogStatus()`/`onEveLogObservation()` are plain Tauri `invoke`/`listen` calls with no
  dependency on `App.svelte`'s state, and Tauri's IPC is shared across every window of the same
  app, so the popout calls them directly. Neither popout exposes write actions (refresh a
  character, change the logs root, etc.) — see gap #1's `account` sub-bullet for why that's
  correctly out of scope until the action-dispatch mechanism exists. The generic placeholder
  branch in `PanelWindow.svelte` is now unreachable for any current `PanelId` value; it's dead
  code, not a bug — safe to leave until a genuinely new panel type needs it, or worth deleting in
  a later cleanup pass.
- Added `popout-account`/`popout-telemetry` command palette entries (`Ctrl+K`) so the two newly
  functional popouts are actually discoverable — before this change there was no way to open
  them at all (`wormhole-chain` has both a palette command and a dedicated "Pop out" button in
  its own header; `fleet-command` only has the palette command; `account`/`telemetry` had
  neither). Matches the exact existing pattern (`lib/commands/palette.ts` + `App.svelte`'s
  `executeCommand`), no new mechanism introduced.
- Fixed `main.ts`'s popout-window `opacity` query-param parsing: a non-numeric value produced
  `Number("...")` = `NaN`, which `Math.max`/`Math.min` silently propagate through the clamp,
  landing an invalid `rgba(2, 6, 23, NaN)` background in `PanelWindow.svelte`. Not reachable
  through the app's own UI today (`windows.rs`'s `open_panel_window` always clamps opacity to
  `[0.35, 1.0]` before building the URL it hands to `main.ts`), but cheap to close since it's
  the one place in the codebase parsing a URL-shaped string without an `isFinite`/`isInteger`
  guard — checked every other `Number(...)` call site in the app and all of them already guard
  correctly (`Number.isInteger(...)` before use, or the `Number(...) || fallback` idiom, which
  works because `NaN` is falsy).
- **Closed a real, plan-mandated testing gap**: PLAN.md §14's M0 acceptance criterion explicitly
  requires "a rotating test log produces one deduplicated typed observation," and §15's testing
  strategy calls for rotation/multiple-character/restart-offset coverage — but
  `src-tauri/src/eve_logs/mod.rs` (the module that handles which file gets a fresh `TailState`
  vs. an existing one, i.e. the actual rotation/multi-session logic) had **zero** tests; only
  `tailer.rs`'s single-file append/EOF-start behavior was covered. Extracted the file-tracking
  logic out of `process_path` into `track_and_read_gamelog()` (pure refactor — the only thing
  `process_path` needed an `AppHandle` for was the `app.emit(...)` call, which stayed put), which
  is now testable without a Tauri `AppHandle` or any new dependency (no `tauri` `test` feature,
  no mocking library — just the same `NamedTempFile` + synthetic jump-line pattern `tailer.rs`'s
  existing tests already use). Added 3 tests: a newly-discovered file (simulating a fresh EVE
  session after relogin) starts from byte 0, not EOF; switching to a new session file tracks it
  independently without disturbing the previous file's offset; re-reading a file after growth
  never replays a previously-emitted observation. This is exactly the class of thing "just
  continue as defined in the plan" should surface — a specific, named acceptance criterion that
  was quietly unverified — as opposed to the log-*parser*-template gap (#2 below), which is
  correctly still blocked on needing real fixtures.
- **Implemented EVE log offset persistence across app restarts** — PLAN.md §9.4 explicitly
  requires persisting `{path fingerprint, session, byte offset, trailing partial line}` so "a
  restart continues safely without replaying historical logs as live," and M1's own acceptance
  criterion says "restart tests preserve offsets." Before this, `EveLogService::start()` always
  called `TailState::existing(path)` (current EOF) for every previously-known gamelog file on
  every single app start — meaning any jump observations written to a gamelog while the desktop
  app was closed were silently skipped forever, not queued or backfilled, every time. Added
  `src-tauri/src/eve_logs/offsets.rs`: a small `PersistedOffsets` map (gamelog path → last-read
  byte offset) serialized to `eve_log_offsets.json` in the app-data directory, loaded once in
  `start()` and written after every successful read in `track_and_read_gamelog()` (so even an
  abrupt process kill loses at most the offset delta since the last read, not since the last
  clean shutdown). Added `TailState::resume(path, offset)` (like `existing()`, but seeds the
  offset from a caller-supplied value instead of current EOF, clamping to the file's current
  length in case it shrank or was replaced since the offset was recorded) and `TailState::offset()`
  to `tailer.rs`. `start()` now checks the persisted map per gamelog file and calls `resume()`
  when an offset exists, falling back to the pre-existing `existing()`/EOF behavior for files it
  has never seen before. **Deliberately scoped to gamelogs only** — chatlog offsets are still
  reset to EOF on every restart, unchanged from before. That's intentional, not an oversight:
  nothing parses chatlog *content* yet (gap #3 below), so there is nothing downstream that could
  be missing an observation by not persisting a chatlog offset; adding that persistence now would
  be speculative complexity with no consumer. Covered by tests in both new files: `offsets.rs`
  tests the save/load round-trip and that a missing/corrupt file degrades to empty rather than
  failing; `tailer.rs` gained `resume_continues_from_a_persisted_offset_instead_of_replaying_it`
  and a clamp test; `mod.rs` gained an end-to-end test
  (`a_restart_resumes_from_the_persisted_offset_instead_of_starting_at_eof`) that runs a full
  "session 1 reads a line, session 2 is a fresh `ServiceState` simulating a restart, EVE wrote
  another line while closed, session 2 must see exactly that one new line" scenario. `cargo test`
  went from 19 (start of this session) to 27.
- **Added map rename and delete** (PLAN.md §11 M-maps "General" tab). `lib/maps/settings.ts`
  gained `renameMap`/`deleteMap` calling `PUT`/`DELETE /api/v1/maps/{slug}` — note the path
  param is `slug`, not `map_slug` like every other maps endpoint; checked the schema rather than
  assuming consistency. `MapRoutingPanel.svelte` gained a name input + Rename button (gated
  behind `settings.canManageAccess`, matching the existing public/share-token controls) and a
  Delete button with an in-UI two-click confirm (click once to arm, click "Confirm delete?" to
  actually call the API, or Cancel) — deliberately not `window.confirm()`, since deleting a
  shared fleet map is a destructive, hard-to-reverse action affecting other users and deserves
  real UI friction, not a browser-native dialog with unclear styling/behavior inside a Tauri
  webview. `App.svelte` reuses `selectMap`'s existing reset-and-reload pattern after a delete
  (clear fleet/chain/regional state, select the next available map or clear entirely, reconnect
  realtime). Investigating this surfaced two related, currently-blocked settings — home
  system/rally point and the access ACL — documented precisely as gap #6 below rather than
  guessed at.

## Recommended order for the next session

1. **Read this file and `graphify-out/GRAPH_REPORT.md`** before making changes — the report's
   "Suggested Questions" section flags real ambiguous edges worth a second look (e.g. whether
   `parseProbeScanner()`'s inferred connections to `pasteSignatures()`/`getSignatureCatalog()`
   are structurally sound). The graph predates this session's component extractions, so treat its
   file-level claims about `App.svelte` as stale; re-run `/graphify --update` if you want it
   current before relying on it for anything App.svelte-specific.
2. If backend `api/v1` work has landed in the main `EveMerc` repo since this was written, run
   `npm run sync:api` first and re-run `npm run check` to catch any type drift.
3. Finish gap #1: convert `createDockWorkspace` to mount `PanelDefinition[]` from
   `moduleRegistry.panels()` instead of scanning static `data-dock-panel` DOM elements. The 12
   components extracted this session (plus `account`, now a real panel) are easy
   `component: () => import('./Foo.svelte')` targets for `PanelDefinition.component` — wire them
   up as real panels instead of mounting them inline. The module-gating half
   (`panelModuleOwners`, `resolveVisiblePanels`) is already done — reuse it, don't re-derive it.
   Before assuming dockview's `ExistingElementRenderer` (DOM-move) approach should be replaced
   wholesale with Svelte's `mount()`/`unmount()`, verify in a real browser whether `mount()`
   gives you live-reactive props when the parent's `$state` changes after the initial mount —
   this session deliberately avoided guessing at that because it's unverifiable without one.
   If it doesn't work as hoped, the DOM-move pattern this session extended to `account` is a
   legitimate permanent approach, not just a stopgap — don't assume it must be replaced.
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
