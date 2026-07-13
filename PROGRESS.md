# EVEMerc Desktop — Progress & Handoff

> Read this before touching code. It records what exists, what was verified working, and what
> the next session should do first. Update this file whenever a milestone-sized chunk of work
> lands — it is the continuity mechanism between sessions/implementers. See [PLAN.md](PLAN.md)
> for the full architecture spec this progress is measured against.

Last updated: 2026-07-13, by a Claude Code session that pushed the initial scaffold to
[github.com/Buzka42/evemerc](https://github.com/Buzka42/evemerc), ran graphify
(`graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.html`), did a first correctness pass,
partially closed gap #1 (module-driven dock: module-gating logic, 12 presentational component
extractions out of `App.svelte`, and finally making `account` a real dock panel), persisted EVE
log offsets across restarts (a named PLAN.md acceptance criterion — see gap history below), and
closed a systematic sweep of PLAN.md §11 feature-parity gaps (map rename/delete, wormhole
connection editing/delete, signature delete/bulk-delete, an EOL-detection bug fix) found by
diffing the vendored OpenAPI schema against what actually has client code calling it — see
"Fixed this session" below for the full list.

## Verified working right now

```
npm test         # 61/61 tests pass (32 files)
npm run check    # svelte-check: 0 errors, 0 warnings
npm run build    # vite build succeeds; main JS bundle 520 KB / 137 KB gzipped
cargo check       # (src-tauri) clean, not re-run this pass (no Rust files touched)
cargo clippy      # (src-tauri) clean, no warnings, not re-run this pass (no Rust files touched)
cargo test        # (src-tauri) 27/27 tests pass, not re-run this pass (no Rust files touched)
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
- The signatures/routing/audits/killfeed/system-intel *sections* still mostly aren't panels —
  they're standalone `.svelte` components (see "Fixed this session"), but most are still mounted
  inline inside the `fleet-command` and `telemetry` dock panels, so they can't be independently
  toggled, popped out, or owned by a module yet. Extracting them into components was a
  prerequisite step, not the fix itself — the remaining work is wiring `moduleRegistry.panels()`
  to actually place them as their own dock panels. (`account` used to be in this list too — see
  below, it's fixed now. `map-settings` — `MapRoutingPanel` + `MapAccessPanel`, previously buried
  inside `telemetry` — is now also a real, independently-toggleable dock panel using the same
  DOM-move mechanism, see "Fixed this session". Still using the closed `PanelId` union, still not
  a `moduleRegistry.panels()`-driven `PanelDefinition`, so it doesn't close the deeper half of
  this gap — but it does shrink `telemetry` and give per-panel toggle/layout control over map
  settings, which is real, incremental progress toward it.)
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

### 6. (Resolved) M-maps "General"/"Access"/Home/Rally — was never actually blocked, two research mistakes corrected

This gap went through two wrong claims before landing on the truth, both worth keeping on record
rather than quietly deleting once fixed:

1. **First version** claimed Home System and Rally Point were blocked because grepping the schema
   for `home_system`/`rally_point` found "zero matches anywhere in a map's GET response." Wrong —
   a narrow grep missed it. The map show response (`getApiV1MapsSlug`, ~line 2670 of
   `schema.d.ts`) documents `home_solarsystem_id`/`rally_solarsystem_id` on the map object; the
   example value (`"home_solarsystem_id": 30000142`) is Jita's real EVE solar system ID, and the
   home-system *write* endpoint takes a *different* id space (`map_solarsystem_id`, a
   map_solarsystem row id) than what the read side reports back — a real asymmetry, now
   implemented correctly against it. Fixed in an earlier commit this session.
2. **Second version** (after fixing the above) claimed the Access ACL was still blocked because
   `GET /api/v1/maps/{map_slug}/access`'s 200-response was undocumented in `schema.d.ts` (only
   the 401 case was) and there was no `DELETE` route for revoking access. Also wrong, and fixed
   by doing exactly what PLAN.md's own Appendix B says to do when the schema is ambiguous: **read
   the web app's Vue/Laravel source** (`C:\Users\Arawn\FZ\EveMerc`, read-only — the actual backend
   repo, not modified) instead of guessing from the incomplete OpenAPI export.
   `app/Http/Controllers/MapAccessController.php`'s `show()` method branches on
   `$request->expectsJson()` and returns the *exact* JSON envelope directly in source:
   `{ data: { entities: [...candidates], entities_with_access: [...MapAccessEntityResource] } }`
   (snake_case `entities_with_access`, unlike everything else this client normalizes to
   camelCase — verified from the controller, not assumed). `MapAccessEntityResource.php` gives
   the exact entry shape (`id`, `name`, `type`, `permission`, `is_owner`, `expires_at`), and
   `Permission.php` confirms the enum (`viewer`/`member`/`manager`). There is no separate revoke
   endpoint because there doesn't need to be one — the same `POST` with `permission: null` on an
   already-granted entity revokes it, which is exactly what the web app's own `toggleAccess()`
   does (`$event === 'none' ? null : ...`).

**Lesson for next time, stated plainly**: when `schema.d.ts` doesn't fully document a response,
that is a signal to go read the *actual backend source* (this repo's PLAN.md Appendix B already
says this — "read the Vue source... never guess" — it just wasn't followed carefully enough the
first two times through this specific gap). An incomplete Scribe export is not the same as an
undocumented API; the ground truth is always the controller/resource source, which is right there
in the sibling repo. Don't declare something "blocked by the backend" without checking that repo
first when it's reachable. See "Fixed this session" for the resulting `lib/maps/access.ts` +
`MapAccessPanel.svelte` implementation.

### 7. (Partially resolved) Signature *editing* was a third wrong "blocked" claim; `map-route-solarsystems` genuinely is blocked

Two more gaps found by the same "grep the schema for endpoints with no client caller" method that
found gap #6, both in `PLAN.md` §11's M-signatures and M-navigation modules:

- **`PUT /api/v1/signatures/{id}`** — this was the *third* time this session a `requestBody?:
  never`/undocumented-in-schema.d.ts endpoint got wrongly declared "blocked" without checking the
  backend source first (same mistake as gap #6's two rounds). Reading
  `app/Http/Controllers/SignatureController.php` (`update()` takes a real, validated
  `SignatureData $signatureData` parameter) and `app/Data/SignatureData.php` directly in the
  backend repo (read-only, not modified) shows the endpoint genuinely accepts a partial body:
  `signature_id`, `signature_type_id`, `signature_category_id`, `map_connection_id`, `mass_status`
  (`fresh|reduced|critical|unknown`), `ship_size` (`frigate|medium|large`), `lifetime`
  (`healthy|eol|critical`), `lifetime_updated_at`, `raw_type_name` — all `sometimes`/nullable, so
  a partial-update PUT is supported. **Now implemented** — see "Fixed this session". Since
  `schema.d.ts` types this operation's `requestBody`/`responses` as `never` (not just missing
  fields, the whole shape), `wormhole/api.ts`'s new `updateSignature()` bypasses openapi-fetch's
  generated types for this one call with an explicit `as unknown as` cast to a hand-written body
  type, documented inline with why. Individual delete (`DELETE /api/v1/signatures/{id}`) and bulk
  delete (`DELETE /api/v1/map-solarsystems/{mapSolarsystem_id}/signatures`) were already fully
  documented and implemented in an earlier pass this session.
- **`map-route-solarsystems` is definitively blocked, not just "never built" — re-verified against
  the backend source, not just the schema, this time.** Read
  `app/Http/Controllers/MapRouteSolarsystemController.php` directly: it only has `store`,
  `update`, `destroy` methods — no `index`/`show`. `routes/api.php` confirms this at the route
  level: `Route::apiResource('map-route-solarsystems', MapRouteSolarsystemController::class)
  ->only(['store', 'update', 'destroy'])` — the read routes were never registered at all, this
  isn't a Scribe documentation gap like gap #6 and the signature-editing claim above.
  `POST`/`PUT /api/v1/map-route-solarsystems[/{id}]` both have
  fully documented request bodies (`map_id`, `solarsystem_id`, `is_pinned?` on create; `is_pinned?`
  on update) — but there is **no `GET` endpoint for this resource anywhere**, and unlike
  connections/signatures/saved-locations, the map show response does not embed a
  `map_route_solarsystems` array either (grepped the whole schema for `map_route_solarsystems`/
  `route_solarsystems` — zero matches). PLAN.md's M-navigation "Routes" panel calls for exactly
  this: "map-route-solarsystems list with live route lengths + quick-select buttons" — a *list*
  is the entire point of the panel, and there is no documented way to fetch one. You could build
  and call `POST`/`PUT`/`DELETE` blind (create a route, immediately forget its id, never see it
  again), but that's not a usable feature, it's a write-only API call with no product value.
  Genuinely blocked on a missing read endpoint, not a design/scope question — don't attempt a
  partial version of this.

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
- **Fixed a verified end-of-life detection bug**: `WormholeChain.svelte`'s `connectionColor()`
  checked `lifetimeStatus === 'end_of_life'` to color a connection amber and dash its stroke, but
  the backend's documented `lifetime`/`lifetime_status` vocabulary (checked in `schema.d.ts`, both
  the write-side PUT enum and every example value in GET responses) is `"healthy" | "eol" |
  "critical"` — `'end_of_life'` never appears anywhere in the schema. The EOL visual indicator
  could never have triggered against real backend data. Fixed both occurrences to check `'eol'`.
- **Implemented wormhole connection editing and delete** (PLAN.md §11 M-map's context-menu spec:
  "connection: mass status, lifetime, ship size, delete") — previously only connection *creation*
  existed; there was no way to ever change a connection's mass/lifetime/ship-size classification
  or remove one, which is core, everyday wormhole-mapping functionality. `wormhole/api.ts` gained
  `updateChainConnection`/`deleteChainConnection` against `PUT`/`DELETE /api/v1/map-connections/{id}`
  — note the PUT body field is literally named `lifetime`, not `lifetime_status` like the GET
  response; another read/write naming split in this backend, caught by reading the schema rather
  than assuming symmetry. `WormholeChain.svelte`'s connection lines are now individually
  selectable (wrapped in a `<g>` with a wide invisible hit-line for easier clicking, matching the
  existing system-node click pattern) and highlight cyan when selected. New
  `ConnectionEditor.svelte` shows mass/lifetime/ship-size `<select>`s seeded from the selected
  connection's current values (via the same `untrack()`-seeded-`$state` + resetting `$effect`
  pattern used for `MapRoutingPanel`'s rename input) plus Save and a two-click-confirm Delete.
- **Implemented signature delete and bulk delete** (PLAN.md §11 M-signatures: "bulk delete").
  `wormhole/api.ts` gained `deleteSignature`/`deleteAllSignatures` against the fully-documented
  `DELETE /api/v1/signatures/{id}` and `DELETE /api/v1/map-solarsystems/{mapSolarsystem_id}/signatures`
  (note the camelCase `mapSolarsystem_id` here vs. the lowercase `map_solarsystem_id` used by the
  *create*-signature endpoint at a *different* path — yet another same-resource naming
  inconsistency across endpoints, not a typo on this side). New `SignatureList.svelte` renders
  the selected chain system's signatures (already present in `ChainMapSolarsystem.signatures`,
  no new fetch needed) with a per-row Delete and a two-click-confirm "Clear all." Signature
  *editing* is separately blocked — see gap #7.
- **Implemented home system and rally point** (PLAN.md §11 M-maps). Turned out these were *not*
  blocked the way gap #6 originally (and wrongly) claimed — the map show response does document
  `home_solarsystem_id`/`rally_solarsystem_id`, a narrower earlier grep just missed it. Confirmed
  both are raw solarsystem ids on the read side (the `home_solarsystem_id` example value in the
  schema, 30000142, is Jita's real system ID) — but the home-system *write* endpoint takes a
  `map_solarsystem_id` instead (a map_solarsystem row id, a different id space from what it
  reports back on read). `ChainSnapshot` gained `homeSolarsystemId`/`rallySolarsystemId`;
  `wormhole/api.ts` gained `setHomeSystem`/`setRallyPoint`. New `HomeRallyControls.svelte` shows
  "Set as home"/"Set as rally" or a badge + clear button for the selected chain system, comparing
  against `chainSnapshot.homeSolarsystemId`/`rallySolarsystemId` using the *system's* raw
  solarsystem id (not its map_solarsystem row id) on both sides of the comparison — the
  home-system id-space mismatch would have made the "is this the home system" check silently
  wrong if built by symmetry with rally point instead of reading the schema's example values.
  Gap #6 corrected to reflect this rather than silently deleted, since the original mistake (a
  narrow grep missing a documented field) is itself worth remembering for next time.
- **Implemented Map Access ACL** (PLAN.md §11 M-maps "Access" tab: grant/revoke/change permission
  for characters/corporations/alliances). New `lib/maps/access.ts` (`fetchMapAccess`/
  `setMapAccess`/`normalizeMapAccess`, with `access.test.ts` covering the normalization
  round-trip and malformed-payload fallback) and `MapAccessPanel.svelte` (renders current access
  entries with an owner badge or a permission `<select>` including "Revoked", plus a "Grant…"
  section for candidates with no access yet). Wired into `App.svelte`: loaded alongside
  `mapRoutingSettings` when `canManageAccess` is true, reset on map delete/logout like the other
  map-scoped state. See gap #6 above for the full story of how this was nearly declared blocked a
  second time and the methodology fix that caught it.
- **Implemented signature editing** (PLAN.md §11 M-signatures). `wormhole/api.ts` gained
  `updateSignature()` against `PUT /api/v1/signatures/{id}`, sending `signature_id`,
  `signature_type_id`, `signature_category_id`, `raw_type_name`. `SignatureList.svelte` gained an
  inline per-row "Edit" affordance (two text inputs for signature id / type name + Save/Cancel,
  matching the existing delete/clear-all button style) alongside the existing delete/bulk-delete
  controls. See gap #7 above for why this required bypassing the generated `schema.d.ts` typing
  (it marks this operation's `requestBody`/`responses` as `never`) with an explicit, documented
  cast to a hand-written body type — the same "Scribe under-documented it" pattern already found
  twice for gap #6, now confirmed a third time by reading `SignatureController.php`/
  `SignatureData.php` directly.

- **Implemented account character removal** (not previously tracked as a gap — found by re-running
  the schema-diff sweep after the Access ACL/signature-editing work). `routes/api.php` in the
  backend registers `DELETE user-characters/{character}` → `AccountController::deleteCharacter()`,
  which is a genuinely distinct capability from the already-implemented "revoke ESI scopes"
  (`revokeCharacterScopes`) — it disassociates the character from the account entirely, and the
  backend refuses with a 422 if it's the account's last character. `lib/account/api.ts` gained
  `removeCharacter()`; `AccountPanel.svelte` gained a per-character two-click-confirm "Remove
  character" button (same established destructive-action pattern as map/connection/signature
  delete), wired through `App.svelte`'s new `removeSelectedCharacter()` handler. The schema-diff
  sweep also confirmed `/api/v1/tokens[/{id}]` and `/api/v1/account/tokens[/{id}]` are duplicate
  route aliases to the same controller methods (same for `/api/v1/account/characters/{id}/preferred`
  vs. `/api/v1/preferred-character/{id}`) — the client's existing choice of path was already
  correct, nothing to change there. `/api/v1/maps/{map_slug}/ping` remains unused (a heartbeat
  endpoint, not obviously needed by anything the client currently does) and
  `/api/v1/account/characters/{character_id}/active` remains unused (a strict subset of what
  `preferCharacter` already does, since `preferCharacter` sets both the active *and* preferred
  character) — neither is a real gap, just left noted here so the schema-diff sweep doesn't
  re-flag them as "new" next time.

- **Split `map-settings` (`MapRoutingPanel` + `MapAccessPanel`) out of the `telemetry` panel into
  its own real dock panel** (gap #1 groundwork — see its entry above for full detail). Extended
  `PanelId` to include `'map-settings'`, added it to `panelModuleOwners` as unowned (`null`, shell
  chrome like `account`, not tied to a toggleable feature module — map settings are core, not
  optional), added it to all three `defaultLayoutProfiles` (visible in Fleet Command and Scanning,
  hidden by default in Compact Fleet, matching how `account` is scoped across the same profiles),
  and added a `panelTitles`/`addPanel` entry in `dock.ts`. Existing saved dockview layouts
  (`localStorage['evemerc.dock.<profileId>']`) predate this panel and won't contain it —
  `loadProfile`'s existing fallback (if a currently-visible panel is missing from the saved JSON,
  discard the saved layout and rebuild fresh) already handles this correctly with no extra code;
  verified this is pre-existing, deliberate behavior, not something added for this change. No
  popout support was added for `map-settings` (unlike `account`/`telemetry`/`wormhole-chain`) —
  its controls are all mutations (rename, delete map, grant/revoke access), and PLAN.md §10.4's
  cross-window action-dispatch mechanism that would let a popout window safely forward those
  writes back to the main window doesn't exist yet for any panel; a stripped read-only version
  wouldn't be useful for a settings panel the way it is for account/telemetry, so it was correctly
  left out rather than half-built.

- **Added a sovereignty overlay to the Regional Map** (PLAN.md §M-regional names "sovereignty
  context" as an explicit requirement, fed by the `reference-intel` module's regional-layer
  extension point — this is exactly the "future intel modules add toggleable overlays through the
  module registry" mechanism PLAN.md describes, not a bolt-on). Investigated two candidate data
  sources before picking one: the `maps/{map_slug}/region/{id}` response (already fetched for
  kill-activity) embeds a `sovereignty` field per system, but reading
  `RegionalMapController.php` directly shows it's **hardcoded to `null`** ("live sov data not
  available from static files") — building against it would show nothing, ever, right now. The
  standalone `GET /api/v1/sovereignties` endpoint is real and populated (`SovereigntyController`
  reads the actual `Sovereignty` model with `alliance`/`corporation`/`faction` relations), so that's
  what's used instead. Response is a JSON *object* keyed by `solarsystem_id`
  (`{"30000142": {...}}`), not an array — confirmed from `SovereigntyController::index()`'s
  `mapWithKeys()` call, since `schema.d.ts` wrongly types this operation's response as
  `Record<string, never>[]` (an empty-object array) — the third or fourth time this session a
  `schema.d.ts` shape has been wrong/incomplete and had to be checked against source, not guessed.
  Bypassed the incorrect generated type with an explicit cast, same pattern as `updateSignature`.
  New `lib/modules/reference-intel/sovereignty.ts`: `normalizeSovereigntyRing()` (id-keyed object
  → `Record<systemId, {label, color}>`, preferring alliance > corporation > faction, deterministic
  HSL color hashed from the ticker/name so the same holder always renders the same color without a
  hardcoded palette) and `loadSovereigntyLayer()`, registered as a second `regionalLayers` entry
  on the `reference-intel` module (alongside the existing `kill-activity` layer) — no new module
  needed, this is exactly what that module already exists for. **Extended the regional-layer
  contract itself**: `RegionalLayerData` gained an optional `rings` field (ownership-style
  `{label, color}` per system) alongside the existing `indicators` field (intensity-glow style, used
  by kill-activity) — kept these as two separate visual channels rather than reusing `indicators`
  for both, because the existing `intelIndicators` merge in `regional/model.ts` is last-write-wins
  per system, so stacking sovereignty into the same map would have silently hidden kill-activity's
  glow on any system with sovereignty (i.e. almost all null-sec) depending on layer order — a real
  bug that was caught by reasoning through the existing merge semantics before writing code, not
  found after the fact. `regional/model.ts` gained a parallel `sovereignty` map built the same way;
  `RegionMap.svelte` renders it as a thin colored ring around the system dot (distinct from the
  glow circle), with the holder name/ticker as an SVG `<title>` tooltip. Covered by
  `sovereignty.test.ts` (normalization, malformed-payload/array fallback, color determinism, the
  public layer contract) and two new cases in `model.test.ts` (indicators and rings stay on
  separate channels; rings stay empty when no layer contributes any). 59/59 tests, 0 type errors,
  clean build (the new module code-splits into its own ~0.7 KB lazy chunk, matching the existing
  `kill-activity`/`provider.ts` pattern).

- **Added the region-picker dropdown** (PLAN.md M-regional: "The region picker is fed by public
  `api/regions`"). Previously the desktop client only ever showed a map's `default_region_id` —
  there was no way to browse a different k-space region's topology at all, unlike the web app.
  `GET /api/v1/regions`'s schema.d.ts entry only documents a 500-error response (Scribe never
  captured a success example for this one) — read `RegionalMapController::regions()` directly to
  get the real shape: a bare `[{id, name}, ...]` array sorted by name, filtered to `type === 'eve'`
  (k-space only). New `lib/regional/regions.ts` (`fetchRegions()`, bypassing the incomplete
  generated type the same documented way as the other under-specified endpoints this session),
  covered by `regions.test.ts`. `App.svelte` gained a `selectedRegionId` state, a
  `loadRegionData(mapSlug, regionId)` helper factored out of the inline logic that used to run
  once at map-load time (now also reusable by the new `changeRegion()` handler), and a region
  `<select>` next to the existing map switcher in the `fleet-command` panel header. Selecting a map
  still defaults to its `default_region_id` as before; the new picker lets the operator additionally
  browse other regions' topology/kill-activity/sovereignty layers without changing which map's
  fleet/chain data is active. `selectedRegionId`/`regions` are reset alongside the other map-scoped
  state on map switch, map delete, and logout — while doing this, also fixed a latent pre-existing
  gap where `regionalLayers` (and now `regions`) weren't being reset on logout, leaving stale data
  briefly visible to whoever logged in next in the same session; small, low-risk fix bundled in
  since it was directly adjacent to the state this change already touches. 61/61 tests, 0 type
  errors, clean build.

## Recommended order for the next session

0. **The most productive technique found this session**: diff `src/lib/api/schema.d.ts` (every
   `"/api/v1/..."` path key) against what's actually called from `src/lib/**/*.ts` (excluding
   `schema.d.ts`/`openapi.yaml` themselves). Every gap found and fixed this session past the
   dock/offset-persistence work (map rename/delete, connection editing, signature delete) was
   found this way, and it also caught two real backend-side naming inconsistencies (`slug` vs.
   `map_slug`, `lifetime` vs. `lifetime_status`) that would have caused silent bugs if guessed
   from memory instead of read from the schema. Re-run this sweep periodically, especially after
   any `npm run sync:api`. When a candidate endpoint's `requestBody`/`responses` in the schema is
   `never` or otherwise underspecified (gaps #6 and #7), that's a real signal to stop and document
   it rather than guess a shape — don't build against an endpoint you can't read the contract for.
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
