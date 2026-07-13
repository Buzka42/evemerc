# EVEMerc Desktop — Full Rebuild Plan

> **Audience:** This document is the complete specification for building the EVEMerc desktop
> application. It is written to be handed to an AI coding assistant (GPT) or a developer with no
> prior knowledge of this project. Follow it top to bottom. Where the document says VERIFY, the
> implementer must confirm the detail against the Laravel backend source before coding against it.
>
> **Backend repo:** this repository (`evemerc/evemerc`, Laravel 12 + Inertia + Vue 3 web app).
> **Desktop repo:** a NEW separate repository, `evemerc-desktop` (structure defined in §4).

---

## 1. Executive Summary

EVEMerc is a Fleet Intelligence Platform for EVE Online: real-time fleet command through a regional
operational map, fleet position and status tracking, collaborative wormhole chain mapping,
signature management, routing, and intel feeds. Today it is
a Laravel 12 + Inertia v3 + Vue 3 web app with realtime updates over Laravel Reverb (Pusher
protocol) and EVE SSO login via Socialite.

We are rebuilding the client as a **native desktop application** with four guiding principles:

1. **Fleet-command first.** The regional map and live fleet state are the primary workspace. The
   application must help a fleet commander understand where pilots are, what they are flying,
   their current status, and where attention is required without changing views.
2. **Precise and real-time.** Fleet position and status updates must be timestamped, visibly stale
   when freshness cannot be guaranteed, and rendered with minimal latency. ESI and local EVE log
   observations are fused; every displayed position retains its source and observation time.
3. **Lightweight.** Small installer, low RAM, instant startup, 60 fps map interaction.
4. **Customizable and extensible.** Product features and future intel sources are modules with
   stable extension points. Disabled optional modules are never loaded, and new intel modules can
   add regional overlays, fleet widgets, alerts, and panels without modifying the app shell.

The Laravel backend stays. The desktop app is a rich client speaking a formal JSON API (REST) plus
Reverb websockets, with a local SQLite cache so the app opens instantly and remains readable when
offline.

## 2. Locked Decisions

These were decided with the project owner on 2026-07-12 and are **not open for re-litigation**
during implementation:

| # | Topic | Decision |
|---|-------|----------|
| 1 | Desktop framework | **Tauri 2** (Rust shell + OS WebView) |
| 2 | Backend model | **Hybrid**: Laravel server remains source of truth; desktop keeps a local SQLite cache (static EVE data + last-known dynamic state) for instant startup and offline reading |
| 3 | UI stack | **Svelte 5** (runes) + TypeScript + Tailwind CSS 4. (Svelte chosen over SolidJS for ecosystem maturity, first-party Vite tooling, and more reliable AI-generated output. If the implementer has a hard blocker with Svelte 5, SolidJS is the approved fallback — do not pick anything else.) |
| 4 | Scope | **Full parity** with the current web app (feature inventory in §11 — parity means the web app as of 2026-07-12; killmail ingestion/threat-analysis features already deleted from the web app are OUT of scope) |
| 5 | Customization | **Module registry + dockable panel layout** (tabs/splits/floating), lazy-loaded modules, named layout profiles |
| 6 | Auth | **System browser + PKCE**: EVE SSO happens in the default browser through the Laravel server; desktop receives a one-time code via deep link/loopback and exchanges it for a Sanctum API token. Tokens in OS credential store |
| 7 | Realtime | **Laravel Reverb websockets** (Pusher protocol), same channels/events the web app uses |
| 8 | Windowing | **Full multi-window**: any panel can pop out into its own OS window (multi-monitor + in-game overlay usage) |
| 9 | Distribution | **Manual installer, no auto-updater** in v1. Windows NSIS `.exe` as the primary target. Keep the code cross-platform-clean; keep updater scaffolding behind a disabled config flag |
| 10 | Repo & contract | **Separate repo** for the desktop app. The API contract is a versioned OpenAPI spec generated from the Laravel backend (Scribe is already installed there) and vendored into the desktop repo |
| 11 | Product hierarchy | **Fleet command is primary**: the regional fleet map is the main workspace; fleet position/status is always visible. The wormhole chain map is a secondary panel placed lower in the default UI and remains fully usable |
| 12 | Local EVE telemetry | **First-class from M0**: tail both EVE `Gamelogs` (combat, notifications, jump/location evidence) and `Chatlogs` (user-enabled chat/intel sources). Raw log text stays local by default; only normalized observations explicitly required by enabled features may leave the device |

## 3. Target Architecture

```
┌────────────────────────────── evemerc-desktop (Tauri 2) ──────────────────────────────┐
│                                                                                        │
│  Rust core (thin)                        WebView UI (Svelte 5 SPA)                     │
│  ┌──────────────────────────┐            ┌──────────────────────────────────────────┐  │
│  │ window management        │  invoke/   │ App shell (title bar, status bar,        │  │
│  │ deep-link (evemerc://)   │  events    │ module launcher, command palette)        │  │
│  │ loopback OAuth listener  │◄──────────►│ Module registry (lazy ES imports)        │  │
│  │ OS keyring (tokens)      │            │ Dockview layout engine                    │  │
│  │ SQLite (tauri-plugin-sql)│            │ Feature modules (fleet, intel, map...)   │  │
│  │ EVE log watcher/parser   │            │ Telemetry fusion (logs + ESI + WS)       │  │
│  │ clipboard, notifications │            │ Data layer: TanStack Query + WS bridge   │  │
│  │ single-instance guard    │            └──────────────────────────────────────────┘  │
│  └──────────────────────────┘                                                          │
│         │local files                                    │HTTPS REST      │WSS          │
│         ▼                                               ▼                ▼             │
│   sde.sqlite (static EVE data)                 ┌────────────────────────────────┐      │
│   cache.sqlite (dynamic state, layouts)        │  Laravel backend (existing)    │      │
│   EVE/{Chatlogs,Gamelogs} (read-only)          │  api/v1 (Sanctum)  +  Reverb   │      │
│                                                └────────────────────────────────┘      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

Data-flow rules (the whole app follows these; do not invent alternatives per feature):

1. **Reads** go through TanStack Query. Query functions read the local cache first (stale-while-
   revalidate), then the API. Successful API responses are written back to `cache.sqlite`.
2. **Mutations** go straight to the API (maps are shared between fleet members — there is no
   local-first write). On success, update the Query cache optimistically where the web app does.
   When offline, mutating UI is disabled with a visible "offline — read only" state.
3. **Realtime events** from Reverb are the primary freshness mechanism: each event both patches the
   TanStack Query cache and upserts `cache.sqlite`. Fleet position/status events carry a server
   timestamp (and a monotonic revision or sequence where available); older updates never overwrite
   newer state. On (re)connect, refetch fleet state and the active regional map first, then heal the
   secondary wormhole map and other active queries. Show stale/unknown state rather than presenting
   cached fleet information as live.
4. **Static EVE data** (systems, regions, wormhole types, signature types, ship types…) never
   comes from per-request API calls. It downloads after installation as a versioned SQLite snapshot (§9.2) and
   is queried locally.
5. **Local EVE telemetry** is tailed from the user's configured EVE logs root. `Gamelogs` supplies
   client-local combat/notification/jump evidence; `Chatlogs` supplies only channels explicitly
   enabled by the user. The parser emits normalized observations, never raw lines, to the UI. On
   first discovery it starts at EOF so historical logs are not replayed as live events.
6. **Source fusion** selects the newest valid observation without erasing provenance. A gamelog
   jump creates an `in_transit` observation toward the destination; confirmation evidence or ESI
   promotes it to `confirmed`. Older timestamps/revisions cannot overwrite newer state. Conflicts
   are shown as uncertain and healed by the next ESI/reconciliation update.

## 4. Desktop Repository Layout

Create a new repository `evemerc-desktop`:

```
evemerc-desktop/
├── src-tauri/                    # Rust
│   ├── Cargo.toml
│   ├── tauri.conf.json           # windows config, bundle config (NSIS), csp
│   ├── capabilities/             # Tauri 2 permission capabilities per window
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── commands/
│       │   ├── auth.rs           # loopback listener, keyring get/set/delete
│       │   ├── eve_logs.rs       # discover/watch/tail EVE Chatlogs + Gamelogs
│       │   ├── windows.rs        # open/close/focus panel windows
│       │   └── sde.rs            # download + verify sde snapshot
│       ├── eve_logs/
│       │   ├── discovery.rs      # default paths, active sessions, rotated files
│       │   ├── tailer.rs         # offsets, partial lines, watcher + polling fallback
│       │   ├── decoder.rs        # BOM-aware UTF-8/UTF-16 decoding
│       │   └── parser.rs         # normalized local observations; no raw text emission
│       └── keyring.rs            # wraps `keyring` crate; service name "evemerc-desktop"
├── src/                          # Svelte 5 + TS
│   ├── main.ts                   # boots SPA; reads ?window= param for popout windows
│   ├── app.css                   # Tailwind 4 entry (@import "tailwindcss"; tokens in @theme)
│   ├── lib/
│   │   ├── api/
│   │   │   ├── openapi.yaml      # VENDORED contract, copied from backend (see §5.4)
│   │   │   ├── schema.d.ts       # generated: npx openapi-typescript openapi.yaml
│   │   │   ├── client.ts         # openapi-fetch client + auth middleware + error mapping
│   │   │   └── queries/          # one file per resource: TanStack Query defs + mutations
│   │   ├── realtime/
│   │   │   ├── echo.ts           # laravel-echo + pusher-js configured for Reverb
│   │   │   ├── mapChannel.ts     # subscribes private-Map.{id}, dispatches to handlers
│   │   │   └── handlers/         # one handler per event (§8.2), patches Query + sqlite
│   │   ├── telemetry/
│   │   │   ├── observations.ts  # typed ESI/log/server observation model
│   │   │   ├── fusion.ts        # ordering, confidence, transit/confirmed state
│   │   │   └── eveLogs.ts       # Tauri events, settings, derived API publication
│   │   ├── cache/
│   │   │   ├── db.ts             # tauri-plugin-sql wrapper, migrations
│   │   │   ├── sde.ts            # typed queries against sde.sqlite
│   │   │   └── dynamic.ts        # upsert/read helpers for cache.sqlite
│   │   ├── auth/
│   │   │   ├── flow.ts           # PKCE flow (§7)
│   │   │   └── session.svelte.ts # $state: current user, characters, token status
│   │   ├── modules/
│   │   │   ├── registry.ts       # FeatureModule interface + registry (§10)
│   │   │   └── <module-id>/      # one folder per feature module (§11)
│   │   │       ├── index.ts      # module manifest (NO heavy imports here)
│   │   │       ├── panels/       # Svelte components, loaded lazily
│   │   │       └── settings.ts   # per-module settings schema + defaults
│   │   ├── layout/
│   │   │   ├── dock.ts           # dockview-core integration + Svelte panel adapter
│   │   │   ├── profiles.svelte.ts# named layout profiles, persistence
│   │   │   └── windows.ts        # popout window orchestration (§10.4)
│   │   ├── components/           # shared UI kit (button, dialog, combobox, table, toast…)
│   │   ├── stores/               # cross-cutting $state stores (connection, settings)
│   │   └── utils/
│   └── windows/
│       ├── MainWindow.svelte
│       └── PanelWindow.svelte    # hosts a single panel when popped out
├── static/                       # app icons, logo
├── scripts/
│   └── sync-api.ts               # copies openapi.yaml from backend artifact + regenerates types
├── package.json
├── svelte.config.js / vite.config.ts / tsconfig.json
└── PLAN.md                       # copy of this document
```

Key dependencies (pin exact versions at project start; do not add others without approval):

- `@tauri-apps/api` v2, plugins: `sql` (sqlite), `deep-link`, `single-instance`, `clipboard-manager`, `notification`, `opener`, `os`, `log`
- Rust crates: `keyring`, `tiny_http` (or `axum`) for the loopback listener, `sha2`/`rand` for PKCE support utilities, `notify` for log rotation/appends, `encoding_rs` for BOM-aware EVE log decoding
- `svelte` ^5, `vite`, `@sveltejs/vite-plugin-svelte` (plain Vite SPA — **no SvelteKit**; there is no server)
- `tailwindcss` ^4 + `@tailwindcss/vite`
- `dockview-core` (framework-agnostic docking)
- `@tanstack/svelte-query` v5
- `openapi-fetch` + `openapi-typescript` (dev)
- `laravel-echo` + `pusher-js`
- `@lucide/svelte` (icons — web app uses lucide-vue-next, keeps icon language identical)
- `date-fns` (already the web app's date lib)

## 5. Backend Workstream (changes in THIS Laravel repo)

The desktop app cannot ship without these server-side additions. They are small because all
domain logic already exists in `app/Actions/*` and `app/Policies/*` — the API controllers must
delegate to those, never duplicate logic.

### 5.1 Formal `api/v1`

`routes/api.php` currently exposes only a handful of endpoints (maps show/index/update,
map-solarsystems, sovereignties). Expand it to a complete `v1` prefix covering every operation the
web UI performs. **Appendix A is the authoritative endpoint inventory** — it maps every existing
web route to its `api/v1` equivalent. Rules:

- All routes under `Route::prefix('v1')->middleware('auth:sanctum')` except the explicitly public
  ones (regions list, sovereignties index, share-token map view).
- Reuse existing FormRequests for validation and existing API Resources for responses. Where a web
  controller returns an Inertia page, the API controller returns the same Resource collection the
  page props contained.
- Same policies (`MapPolicy`, `MapSolarsystemPolicy`, `SignaturePolicy`, …) via `authorize()`.
- Responses are stable: never return page-shaped Inertia props from `api/v1`.

### 5.2 Desktop auth bridge (PKCE)

Add three endpoints (detailed flow in §7):

- `GET  /auth/desktop/start` — begins a desktop login. Params: `code_challenge` (S256),
  `redirect_uri` (must be `evemerc://auth/callback` or `http://127.0.0.1:{port}/callback`),
  `state`. Stores them in the session, then redirects into the existing EVE SSO Socialite flow.
- Existing `GET /eve/callback` — after the normal login logic succeeds, if the session contains a
  pending desktop login: generate a random one-time code (store hash + code_challenge + user id,
  5 min TTL, single use, in cache), then redirect to the desktop `redirect_uri` with
  `?code=...&state=...`. Otherwise behave exactly as today.
- `POST /api/v1/auth/token` — body: `{ code, code_verifier, device_name }`. Verifies
  `sha256(code_verifier) == code_challenge`, consumes the one-time code, and returns
  `{ token }` — a Sanctum personal access token named after `device_name`.
- `DELETE /api/v1/auth/token` — revokes the current token (logout).
- `GET /api/v1/me` — current user + characters + scope status (mirror of `UserResource` +
  `CharacterResource` props the web app receives via `HandleInertiaRequests`).

Adding ESI scopes to a character reuses the same browser flow: the desktop opens
`/scopes/add` (existing page) in the system browser; completion is detected by refetching
`/api/v1/me`.

### 5.3 Broadcasting auth for token clients

The web app authorizes the private channel `Map.{map}` via session cookies. Desktop clients hold a
Bearer token instead. Register the broadcasting auth route to also accept Sanctum:
`Broadcast::routes(['middleware' => ['auth:sanctum']])` on an API path (e.g.
`/api/v1/broadcasting/auth`). Channel authorization logic in `routes/channels.php`
(`$user->can('view', $map)`) is unchanged.

### 5.4 OpenAPI contract export

Scribe (`knuckleswtf/scribe`) is already installed. Annotate the `api/v1` controllers, then:

- `php artisan scribe:generate` emits `openapi.yaml` with the current Scribe configuration.
- CI publishes the YAML file as a build artifact; the desktop repo's `scripts/sync-api.ts` copies
  it to `src/lib/api/openapi.yaml` and runs `openapi-typescript` to regenerate `schema.d.ts`.
- The OpenAPI file is the single source of truth for request/response shapes. If desktop code
  needs a field that is not in the spec, the fix is a backend PR, never a hand-edit of the types.

### 5.5 SDE snapshot endpoint

- `GET /api/v1/sde/version` → `{ version: "<hash-or-date>", size_bytes, url }`
- `GET /api/v1/sde/snapshot` → downloads a prebuilt, gzipped SQLite file containing the static
  tables listed in §9.2. Build it with a new artisan command `sde:build-snapshot` (scheduled after
  SDE updates). The desktop compares versions on startup and re-downloads when changed.

### 5.6 Fleet/status polling endpoints already exist

`GET maps/{map}/fleet/status`, zKillboard proxies (`recentKills`, `fleetKills`, `systemJumps`,
`systemKillStats24h`), and `maps/{map}/ping` move under `api/v1` per Appendix A — same
controllers, JSON out.

### 5.7 Fleet operational-state contract (priority backend work)

The existing fleet/status endpoints and events must be upgraded into an explicit operational-state
contract before M2. `GET /api/v1/maps/{map}/fleet/status` returns a complete reconciliation
snapshot containing `revision`, `generated_at`, fleet/commander identity, and members. Every member
contains stable character id, name, confirmed solar-system id, ship type/id, role/squad where ESI
provides it, online/status flags, `observed_at`, and source. Unknown values are `null`; the server
must never substitute a guessed current position.

`FleetMembersUpdatedEvent` and `CharacterStatusUpdatedEvent` must include the affected identifiers,
changed fields, `observed_at`, and a monotonic fleet or entity revision. Create/update/delete event
semantics must be documented in the event catalog. The desktop discards an event older than the
stored revision/timestamp and uses the snapshot endpoint after reconnect to reconcile missed
events. VERIFY ESI polling cadence and surface it in the API so the UI's stale threshold reflects
the source's real precision rather than implying continuous telemetry.

### 5.8 Client location observations from EVE logs

Add `POST /api/v1/location-observations`. It accepts only normalized derived data:
`{ character_id, solar_system_id, observed_at, state, source_event_id }`, where `state` is
`in_transit|confirmed` and the authenticated user must own the character. The server rejects future
timestamps outside a small clock-skew allowance, observations older than the stored source state,
unknown systems, duplicate `source_event_id` values, and payloads for another user's character.
Rate-limit per token and character.

The server stores provenance (`source = eve_gamelog`), observation time, and state separately from
ESI polling metadata; it must not rewrite an ESI observation timestamp as though ESI supplied the
log result. Accepted observations update the fleet operational snapshot revision and broadcast a
timestamped/revisioned character or fleet patch. Raw log lines, chat messages, combat text, file
paths, and character session headers are never accepted by this endpoint.

Source arbitration rules are explicit and testable: newer confirmed observations beat older ones;
`in_transit` is displayed distinctly and does not masquerade as a confirmed destination; ESI or a
later supported gamelog confirmation may confirm the target. If sources disagree at comparable
times, retain both observations and expose an uncertain state until reconciliation.

## 6. What the Rust Core Does (and nothing more)

Keep Rust focused on OS integration and the local privacy boundary; product decisions, fusion,
alerts, and UI logic live in TypeScript. EVE file discovery/tailing/decoding and the minimal proven
line parser stay in Rust so raw log text never crosses into the WebView or plugin modules.

| Command / plugin | Responsibility |
|---|---|
| `single-instance` plugin | Second launch focuses the existing main window and forwards any deep-link argv |
| `deep-link` plugin | Registers `evemerc://` scheme; emits `auth:callback` event with URL to the UI |
| `commands::auth::start_loopback(port_range) -> {port}` | Fallback OAuth receiver: binds `127.0.0.1:0`, serves one request to `/callback`, returns query params to UI via event, then shuts down. Responds with a tiny "You can close this tab" HTML page |
| `commands::auth::keyring_get/set/delete(key)` | OS credential store. Keys: `api_token`, `server_url` is NOT secret (plain store). Never write tokens to disk elsewhere |
| `commands::windows::open_panel(panel_id, title, opts)` | Creates a `WebviewWindow` loading `index.html?window=<panel_id>`; applies `always_on_top`, `decorations`, size/position from opts; persists window geometry |
| `commands::sde::download_snapshot(url, expected_version)` | Streams download to app-data dir, gunzips, atomically swaps `sde.sqlite` |
| `commands::eve_logs::start(root, enabled_channels)` | Discovers active EVE sessions, tails `Gamelogs` and allowed `Chatlogs`, survives file rotation, and emits normalized observations to the main window |
| `commands::eve_logs::status()` | Returns resolved paths, active character/session ids, watched-file counts, last append/parse times, and health/errors without returning log contents |
| `tauri-plugin-sql` | Opens `sde.sqlite` (read-only) and `cache.sqlite` (read-write, migrations run by UI on boot) |
| `log` plugin | Rust + JS logs to rotating file in app-data dir |

Tauri 2 capabilities: give the main window and panel windows the same capability set (sql, events,
clipboard read, notification). Only the main window gets the auth commands.

## 7. Authentication Spec (System Browser + PKCE)

State machine lives in `src/lib/auth/flow.ts`.

1. User clicks **Log in with EVE Online**.
2. Desktop generates `code_verifier` (43–128 chars, crypto-random) and `state`; computes
   `code_challenge = base64url(sha256(code_verifier))`.
3. Desktop starts BOTH receivers: deep-link listener (`evemerc://auth/callback`) and the loopback
   listener (fallback for machines where scheme registration failed). The `redirect_uri` sent is
   the deep link; if scheme registration is known-broken (Rust command reports it), use loopback.
4. Opens system browser (via `opener` plugin) at
   `{server}/auth/desktop/start?code_challenge=...&state=...&redirect_uri=...`.
5. User completes EVE SSO in the browser (password managers + 2FA work normally).
6. Browser redirects to the `redirect_uri` with `code` + `state`. Desktop validates `state`.
7. Desktop calls `POST /api/v1/auth/token` with `{code, code_verifier, device_name: hostname}`;
   receives Sanctum token; stores it in the OS keyring; fetches `/api/v1/me`; connects Reverb.
8. **Logout:** `DELETE /api/v1/auth/token`, wipe keyring entry, disconnect WS, purge
   `cache.sqlite` dynamic tables (keep SDE), return to login screen.
9. **401 handling:** any API 401 → token invalid → same as logout but keep a "session expired"
   message.
10. Server URL is configurable at the login screen (defaults to the production URL) so dev/staging
    servers work. Persist in plain settings store.

Security requirements: never log tokens; keyring only; TLS required except when host is
`localhost`/`127.0.0.1`; one-time codes expire in 5 minutes and are single-use (backend, §5.2).

## 8. Realtime Spec (Reverb)

### 8.1 Connection

`laravel-echo` with the `pusher` broadcaster pointed at the Reverb host (`wsHost`, `wsPort`,
`forceTLS: true` in prod), `authEndpoint: {server}/api/v1/broadcasting/auth` with the Bearer token
header. One shared Echo instance per *process* (main window owns it — popout windows receive data
via inter-window events, §10.4, so we hold one WS connection total, not one per window).

Connection states surface in the status bar: `connected / reconnecting / offline`, alongside the
age of the newest fleet update. On transition to `connected` after a gap, refetch current fleet
membership, pilot positions/statuses, and the active regional map before lower-priority panels
(§3 rule 3). Mark individual pilots stale when their last server update exceeds the configured
freshness threshold; never silently infer that a cached position is current.

### 8.2 Channels & events

Channel: `private-Map.{mapId}` — subscribe when a map is opened, leave when closed.
Events broadcast today (class names; VERIFY each `broadcastAs()` name and payload shape while
building §5.4 — document them in the OpenAPI description or a companion `events.md` in the
backend repo):

| Event class | Handler behavior (desktop) |
|---|---|
| `MapSolarsystems\MapSolarsystemCreatedEvent` | Upsert system node; render on canvas |
| `MapSolarsystems\MapSolarsystemUpdatedEvent` / `MapSolarsystemsUpdatedEvent` | Patch node(s) (position, alias, status, pinned…) |
| `MapSolarsystems\MapSolarsystemDeletedEvent` / `MapSolarsystemsDeletedEvent` | Remove node(s) + attached connections |
| `MapConnections\MapConnectionCreatedEvent` / `Updated` / `Deleted` / `MapConnectionsDeletedEvent` | Upsert/remove edges (mass status, lifetime, ship size) |
| `Signatures\SignatureCreatedEvent` / `Updated` / `Deleted` | Patch signature list for the affected system |
| `Maps\MapUpdatedEvent` | Patch map meta (name, rally point, home systems…) |
| `MapRouteSolarsystemsUpdatedEvent` | Refresh routes panel |
| `Characters\CharacterStatusUpdatedEvent` | Move the pilot on the regional operational map and secondary chain map; update location, ship, status, server timestamp, and freshness |
| `Fleet\FleetMembersUpdatedEvent` | Patch fleet composition and commander summaries immediately; reconcile by revision so delayed events cannot roll state back |
| `Fleet\FleetWaypointSetEvent` | Toast + highlight waypoint target |
| `Fleet\SystemKillStatsUpdatedEvent` | Update kill-activity badges on regional/killfeed views |
| `ServerStatusUpdatedEvent` | Update TQ status indicator (VERIFY channel — likely public/global) |

Every handler does exactly two things: patch the TanStack Query cache (`setQueryData`) and upsert
`cache.sqlite`. No component subscribes to Echo directly.

## 9. Local Cache Spec (Hybrid)

### 9.1 `cache.sqlite` (dynamic, per-server-URL)

Tables (schemas mirror the API Resources; store raw JSON payload plus indexed columns):

```
maps(id PK, payload JSON, updated_at)
map_solarsystems(id PK, map_id, solarsystem_id, payload JSON, updated_at)
map_connections(id PK, map_id, payload JSON, updated_at)
signatures(id PK, map_solarsystem_id, payload JSON, updated_at)
characters(id PK, payload JSON, updated_at)          -- own characters + statuses
meta(key PK, value)                                  -- e.g. last_user_json, sde_version
```

Boot sequence: open cached data → paint UI immediately (grey "cached" badge) → fire API refetches
→ reconcile. Offline: everything renders from cache read-only; mutations disabled.

### 9.2 `sde.sqlite` (static, shared across servers)

Built by the backend (§5.5). Minimum tables: `solarsystems` (id, name, security, region_id,
constellation_id, class, effect), `regions`, `constellations`, `stargates/jumps` (for local route
math if present server-side; otherwise routing stays a server call — VERIFY how
`MapRouteSolarsystemController`/navigation compute routes and mirror that decision),
`wormholes` (hole types: mass, lifetime, jump mass), `wormhole_statics`, `wormhole_effects`,
`signature_types` + `signature_categories`, `types` subset (ships: id, name, group) for ship
history/fleet composition display, `sovereignties` snapshot.

### 9.3 Layout & settings persistence

Local only (not synced in v1): `settings.json` via plugin-store — enabled modules, layout
profiles (serialized dockview layouts + popout window geometry), per-module settings, theme,
server URL. Export/import profile as JSON file (nice-to-have, M6).

### 9.4 Local EVE log ingestion

Default root on Windows: `%USERPROFILE%\Documents\EVE\logs`, with automatic discovery of redirected
Documents folders and a user-selectable override. Watch sibling `Gamelogs/` and `Chatlogs/`; never
hardcode a developer-specific absolute path. The supplied corpus confirms that EVE creates a new
session file per login/character and that filenames commonly carry session time plus character id.
Treat headers and filenames as identification hints, validate them against the authenticated user's
characters, and do not trust arbitrary filenames as authorization.

Tailer requirements:

- First discovery starts at EOF. Persist `{path fingerprint, session, byte offset, trailing partial
  line}` locally so restart continues safely without replaying historical combat/chat as live.
- Handle create/rename, truncation, rapid append bursts, UTF-8 BOM and UTF-16 variants, partial
  multibyte characters, and lines split across writes. Windows watcher notifications may coalesce;
  combine `notify` with a low-cost polling fallback.
- Track multiple simultaneously logged-in characters independently. A newly created session file
  supersedes the prior active file for the same character but does not discard its final partial line.
- Convert EVE timestamps to UTC instants, deduplicate by a local `source_event_id` derived from
  session/file fingerprint + byte range + normalized event kind, and never use wall-clock arrival
  order as the sole ordering rule.
- Parse `Gamelogs` into typed events such as `jump_started`, `location_confirmed` (only for templates
  proven by fixtures), `combat_hit`, `combat_miss`, `warp`, and `session_started`. Unknown templates
  stay local and increment diagnostics; never guess a system or combat entity.
- `Chatlogs` is opt-in per channel/pattern. Local-channel headers observed in the supplied corpus use
  `Channel ID: local` and do not identify the solar system, so Local chat alone is not accepted as
  location proof. Future intel parsers receive normalized chat records only after explicit enablement.
- Raw lines remain in memory only long enough to parse and are never written to `cache.sqlite`, logs,
  diagnostics, Sentry, or the backend. Diagnostics contain counts, offsets, parser versions, and
  redacted error categories only.

## 10. Module System & Windowing Spec

### 10.1 FeatureModule contract

```ts
export interface PanelDef {
  id: string;                    // "signatures.list"
  title: string;
  icon: IconName;                // lucide icon name
  component: () => Promise<Component>;  // lazy import — REQUIRED
  defaultPlacement: 'center' | 'left' | 'right' | 'bottom' | 'floating';
  popoutable: boolean;           // may open as own OS window
  minSize?: { w: number; h: number };
  requiresMap?: boolean;         // only available when a map is open
}

export interface FeatureModule {
  id: string;                    // "signatures"
  title: string;
  description: string;           // shown in the module manager
  icon: IconName;
  core?: boolean;                // core modules can't be disabled ('regional' and 'fleet')
  panels: PanelDef[];
  regionalLayers?: RegionalLayerDef[]; // lazy map overlays; no direct map implementation imports
  fleetWidgets?: FleetWidgetDef[];     // FC status cards, alerts, summaries
  intelProviders?: IntelProviderDef[]; // normalized, typed intel contributions
  commands?: CommandDef[];
  settings?: SettingsSchema;     // rendered generically in the settings dialog
  onEnable?(ctx: ModuleCtx): void | Promise<void>;   // subscribe queries, register commands
  onDisable?(ctx: ModuleCtx): void;                  // MUST fully tear down
}
```

Rules: a module's `index.ts` manifest imports nothing heavy (components, map layers, and providers
are dynamic imports); disabling a module removes its contributions from all layouts and unloads
its subscriptions; the module manager UI (in Settings) lists all optional modules with toggle +
description + per-module settings. Modules never import one another. They communicate through
versioned `ModuleCtx` services and normalized domain events. Adding an intel tool must not require
editing the regional-map, fleet, or shell module; it registers through `regionalLayers`,
`fleetWidgets`, `intelProviders`, and `commands`.

### 10.2 Docking

`dockview-core` drives the main window layout: tabbed panels, split arbitrarily, drag to
rearrange, float within the window. Write one thin adapter that mounts/unmounts a Svelte component
per dockview panel (`mount(Component, { target, props })` / `unmount` from Svelte 5). Persist
serialized layout per profile on every change (debounced 1 s).

**Layout profiles:** named snapshots (e.g. "Fleet Command", "Scanning", "Krab"). Switching
profiles applies enabled-module set + dockview layout + popout windows. Ship two built-in defaults:
"Fleet Command" (regional map center, fleet status/composition beside it, alerts and system intel
right, wormhole chain map in a shorter lower panel) and "Minimal FC" (regional map plus compact
fleet status). The regional operational picture and fleet freshness indicator remain visible in
every built-in profile.

### 10.3 Command palette & shortcuts

Global `Ctrl+K` palette listing: open panel X, switch profile, switch map, toggle module, copy
system name, paste signatures. Modules register commands via `ModuleCtx`. Global shortcuts:
`Ctrl+Shift+V` paste signatures (when a system is selected), `Ctrl+1..9` switch profile.

### 10.4 Multi-window (popouts)

- Any `popoutable` panel gets a "pop out" button in its dockview tab → Rust `open_panel` creates a
  new WebviewWindow loading the SPA with `?window=<panelId>&map=<mapId>`.
- `PanelWindow.svelte` renders exactly that panel, chromeless (custom mini title bar: title, pin
  [always-on-top toggle], opacity slider 40–100%, close).
- **State authority:** the main window owns Echo + TanStack Query truth. Popouts request initial
  data and receive updates via Tauri `emit`/`listen` events (`state:patch:{queryKey}`); mutations
  from popouts are forwarded to the main window (`action:dispatch`) which performs the API call.
  If the main window closes, all popouts close (v1 simplification).
- Always-on-top + compact density + opacity makes any popped-out panel an in-game overlay. A compact
  fleet status/alerts window and regional operational map are the flagship overlay use cases; the
  chain map remains available as a secondary overlay. Panel windows remember geometry per panel id.

## 11. Feature Inventory — Full Parity (modules)

Every module below must exist at v1. Endpoint names refer to Appendix A; events to §8.2.
For each module: panels it contributes, and behavior notes (source of truth = the current Vue
implementation in `resources/js/` of the backend repo — port behavior, not code).

The immutable product hierarchy is: **regional fleet command first, live fleet state second,
supporting intel third, wormhole chain mapping secondary**. Docking allows users to resize or
pop out any panel, but the shipped UI and milestone priorities must preserve that hierarchy.

### M-local-telemetry (core service, non-disableable) — EVE logs + ESI fusion

No main panel. Settings exposes the detected EVE logs root, per-character session health, last
gamelog observation age, parser version, and opt-in chat-channel allowlist. It tails local logs via
the Rust core, resolves system names through `sde.sqlite`, fuses observations with ESI/server state,
and publishes permitted normalized location observations through §5.8. A small source/freshness
badge appears wherever a pilot position is shown (`ESI`, `game log`, `in transit`, `uncertain`,
`stale`). Combat/chat-derived intel features are optional modules built on its typed local event bus;
they never receive unrestricted filesystem access.

### M-map (secondary, enabled by default) — Wormhole chain map
Panels: **Chain Map** (lower panel by default; expandable, dockable, and popoutable). The interactive canvas: system nodes (name, alias, class,
security, effect, statics, sovereignty icon, pilot count badges, rally badge, "has signatures"
indicator, status coloring, pinned state), connections (wormhole mass/lifetime styling, EOL,
frigate-size, jump direction), pan/zoom, drag systems (persist positions), multi-select
(box-select; bulk move/delete via `map-selection` endpoints), context menus (system: set status,
alias, pin, copy name [alias-prefixed], set destination, delete; connection: mass status,
lifetime, ship size, delete; map: add system, paste signatures), add-system search combobox,
ping (`maps/{map}/ping`). Renders from cache instantly. Realtime: all MapSolarsystem/MapConnection
events. Implementation note: render as SVG/canvas hybrid — nodes as positioned HTML/SVG for
crisp text, edges as SVG paths; virtualize label detail below zoom threshold; target 60 fps at
150+ systems.

### M-maps — Map management
Panels: **Map Switcher** (modal/palette rather than page), **Map Settings** (dialog with tabs:
General [rename, delete, toggle public, share tokens], Access [ACL for characters/corps/alliances
with expiry — `map-access` endpoints], Preferences [default layout hints, tracking prefs,
map-user-settings], Routing [routing settings], Home System, Rally Point). Uses maps CRUD +
settings endpoints. Desktop replaces the web's separate settings pages with one dialog.

### M-signatures — Signature management
Panels: **Signatures** (bottom, per selected system). Table (sortable): sig id, group, type/name,
linked connection, age/decay timers with color states, actions. CRUD via signature endpoints;
**paste parser**: `Ctrl+Shift+V` or button reads the clipboard (Tauri clipboard plugin), sends raw
text to `paste-signatures` endpoint, shows the web app's replace/update warning dialog when sigs
would be removed; bulk delete; link signature ⇄ wormhole connection (creates map connection when
appropriate — mirror `PasteSignaturesAction`/`StoreSignatureAction` behavior). Realtime: Signature events.

### M-tracking — Character tracking & ship history
Panels: **Characters** (list of own characters: online status, current system/ship, tracking
toggle, preferred character star), **Current Ships** (ship history card). Tracking toggle posts to
`tracking` endpoint; server-side polling (`UpdateCharacterLocation`) auto-adds jumped-into systems
to the map — desktop only reflects state. Realtime: `CharacterStatusUpdatedEvent` moves pilots on
the chain map. Port `ActiveCharacterWarning` (character in-map but tracking off).

### M-intel — System info & killfeed
Panels: **System Info** (right; static info: class/effect/statics from SDE, sov structures via
`system/{id}/sov-structures`, jumps + 24h kill stats via zKillboard proxy endpoints), **Killfeed**
(recent kills for selected system / fleet kills for map via proxy endpoints; each row links out to
zKillboard in system browser). Poll interval configurable per panel; also driven by
`SystemKillStatsUpdatedEvent`.

### M-navigation — Routing & autopilot
Panels: **Routes** (map-route-solarsystems list with live route lengths + quick-select buttons),
**Route Finder** (find-systems search, shortest path display, per-map routing settings honored,
ignore-list management [add/remove/clear via ignore endpoints]), waypoint actions ("set
destination" per system + bulk waypoints) calling waypoint endpoints, which push to the EVE client
via ESI. Realtime: `MapRouteSolarsystemsUpdatedEvent`.

### M-fleet (core, non-disableable) — Fleet command and live status
Panels: **Fleet Command Bar** (always visible: fleet identity, commander, member count, online/
stale/unknown counts, current objective and connection freshness), **Fleet Composition** (members
grouped by system/ship/role with last-update age), **Fleet Alerts** (pilot disconnected, stale
position, unexpected movement, composition/status changes), **Fleet Controls** (register/
deregister and status), and **Fleet Commanders** (manage commanders). Selecting a pilot or group
focuses the regional map and exposes relevant actions without leaving the main workspace.
Endpoints remain under `maps/{map}/fleet/*`. Fleet waypoint broadcast
(`FleetWaypointSetEvent`) → toast + regional highlight + optional auto-set-destination. Incoming
member/status updates patch rows and map markers in place; a full list refetch is reconciliation,
not the normal update path.

### M-evescout — EVE-Scout (Thera/Turnur)
Panels: **EVE-Scout** (public connection list; one-click "add to map" via
`eve-scout-connections` endpoint).

### M-regional (core, non-disableable) — Fleet operational map
Panels: **Regional Map** (primary center workspace). It shows precise live fleet positions and
status on the stargate/region topology, including per-system pilot clusters, ship/role summaries,
movement direction and recency, commander/objective/waypoint emphasis, stale/unknown markers,
sovereignty context, and kill activity from `SystemKillStat`. Selecting a system filters the fleet
composition and intel panels; selecting a fleet member centers their last confirmed position.
The region picker is fed by public `api/regions`; topology and activity come from
`maps/{map}/region/{region}` plus local SDE data and realtime fleet/character events. Future intel
modules add toggleable overlays through the module registry instead of editing this module.

### M-locations — Saved locations
Panels: **Saved Locations** (per-map bookmark list; create/delete via saved-location endpoints).

### M-audits — Map activity log
Panels: **Audits** (paginated audit trail for the map — who added/removed what; from map show
payload / audits resource).

### M-stats — Statistics
Panels: **Statistics** (map statistics view; `statistics` endpoint. VERIFY exact semantics of
`StatisticsController::store` — it appears to generate a statistics report for a map).

### M-account — Account & tokens (not a panel; Settings sections)
Character management (unlink character, set preferred), ESI scope management (list per-character
scopes, "add scopes" opens system browser to the existing web flow, revoke), API token management
(list/revoke Sanctum tokens — the web `tokens` resource). Server status indicator (TQ online +
player count) in the status bar via `ServerStatusUpdatedEvent`.

**Explicitly out of scope (removed from web app pre-rebuild):** killmail ingestion/listener,
wormhole system analysis, threat analysis, killmail notes. The zKillboard *proxy* features above
remain IN scope.

## 12. Design System & Branding

- **Dark-first sci-fi minimal.** Port the web app's existing Tailwind theme tokens (see
  `resources/css/` in the backend repo) into Tailwind 4 `@theme` variables; keep the same hue
  language so existing users feel at home. Light theme supported but dark is default.
- Density: `comfortable` (default) and `compact` (auto-applied in popout windows < 500 px).
- Icons: `@lucide/svelte`, same names as the web's lucide-vue-next usage.
- Typography: Inter (bundle locally — no CDN fonts; the app must work offline).
- **Operational hierarchy:** fleet freshness, alerts, member status, and the regional map receive
  the strongest visual priority. The secondary chain map is shorter and lower by default. Color is
  reserved for actionable state (movement, warning, stale, disconnected, objective, hostile
  activity); do not spend alert colors on decoration.
- Custom title bar on the main window (native decorations off): app logo, map switcher, profile
  switcher, connection/fleet-freshness status, window controls.
- **Logo/branding:** the current logo lives in `resources/js/components/icons/Logo.vue` /
  `LogoFull.vue` (SVG — reuse directly). New desktop icon set (`.ico`, 16–512 px PNGs) stored in
  `static/` + `src-tauri/icons/`. Two 1024×1024 icon concepts were generated with Higgsfield
  (dark navy + cyan wormhole-network emblem, no text) — pick one, download the PNG, and run
  `tauri icon <png>` to produce the full icon set:
  - Concept A: https://d8j0ntlcm91z4.cloudfront.net/user_3GJvST6yxHGuNl3kTy9d1znCtxQ/hf_20260712_182513_4fd77cd9-ea83-48df-9c0d-da8cffbc1619.png
  - Concept B: https://d8j0ntlcm91z4.cloudfront.net/user_3GJvST6yxHGuNl3kTy9d1znCtxQ/hf_20260712_182514_62e3f613-57e6-4579-8216-edbe402cbe4b.png

## 13. Non-Functional Requirements

| Budget | Target |
|---|---|
| Installer size | < 15 MB (NSIS) |
| Cold start → interactive (cached map) | < 1.5 s |
| Idle RAM, main window, 1 map open | < 200 MB |
| Regional map | 60 fps pan/zoom with 500 visible fleet markers and active intel overlays |
| Wormhole chain map | 60 fps pan/zoom @ 150 systems / 200 connections |
| Fleet event latency | p95 < 250 ms from websocket receipt to visible map/status update; target < 1 s backend publish to visible update under normal network conditions |
| Local log latency | p95 < 250 ms from completed gamelog line append to visible local position/state update |
| Log watcher overhead | < 1% average CPU while idle; bounded memory independent of historical log-folder size |
| Fleet freshness | Every position/status displays server update age; stale/unknown states are explicit and delayed events cannot overwrite newer revisions |
| JS bundle (initial, before lazy modules) | < 400 KB gzipped |
| Offline behavior | Full read of last-known state; clear read-only indicator; auto-reconnect with backoff |

Error handling: central API error mapper (401 → re-auth; 403 → permission toast; 409/422 →
inline form errors; 5xx/network → retry with backoff + offline banner). All errors logged to the
rotating file log; a "copy diagnostics" button in Settings gathers app version, OS, server URL,
recent log tail (never tokens).

## 14. Milestones (build order — even at full parity, ship in this sequence)

- **M0 — Foundations:** repo scaffold per §4; Tauri app boots; CI (typecheck, lint, build,
  `cargo clippy`); app icons generated; backend workstream §5 lands in parallel (API v1 + auth
  bridge + OpenAPI export + SDE snapshot + location-observation contract). Build the Rust EVE-log
  discovery/tailer/parser spike against sanitized fixtures derived from both supplied `Gamelogs`
  and `Chatlogs`. *Accept:* `npm run tauri dev` shows shell; openapi.yaml vendored + types generated;
  a rotating test log produces one deduplicated typed observation without exposing raw text.
- **M1 — Auth + shell:** PKCE flow end-to-end incl. keyring + deep link + loopback fallback;
  `/api/v1/me`; module registry + module manager UI; dockview with empty placeholder panels;
  layout profiles persist; local telemetry service discovers configurable/default EVE folders,
  handles multiple sessions, and reports health. *Accept:* login on fresh Windows VM; layouts survive
  restart; append/rotation/restart tests preserve offsets and never replay historical lines as live.
- **M2 — Fleet command read path:** SDE topology; regional map as the primary workspace; fleet
  composition, positions, ships, statuses, update ages, and stale/unknown states; Reverb patches
  markers and status in place; ESI + gamelog position fusion with provenance and `in_transit`
  state; offline cached state is clearly historical. *Accept:* commander can locate every reporting
  fleet member, see each source/age, and identify transit/stale/unknown/conflicting pilots at a
  glance; a gamelog jump updates locally within budget and is reconciled through the server.
- **M3 — Fleet command actions + extensible intel:** fleet registration/commanders, waypoint and
  objective highlighting, fleet alerts, regional-map layer registry, intel provider contract, and
  one reference intel overlay. *Accept:* an FC can manage and direct the fleet from the regional
  workspace, and a test intel module can be added without modifying shell/regional/fleet code.
- **M4 — Secondary wormhole workflow:** full chain-map read/write path, signatures including paste
  parser, tracking integration, EVE-Scout, and navigation. *Accept:* full scan-and-map workflow is
  usable in the lower panel or a popout without obscuring fleet command state.
- **M5 — Remaining intel and parity modules:** M-intel, M-locations, M-audits, M-stats, M-account,
  and remaining parity work. *Accept:* feature-parity checklist against §11 signed off.
- **M6 — Multi-window + polish + package:** popouts with always-on-top/opacity; command
  palette; performance budget pass (§13); NSIS installer, signed if cert available; README with
  install instructions. *Accept:* installer on clean Windows 10/11; overlay usable over EVE
  client in borderless-windowed mode.

## 15. Testing Strategy

- **Contract:** generated types compile against every query/mutation (typecheck IS the contract
  test); backend Pest feature tests for every new `api/v1` endpoint + the PKCE bridge (happy,
  failure, expiry, replay) and Sanctum broadcasting auth.
- **Unit (vitest):** fleet revision ordering, stale/unknown transitions, alert rules, regional
  marker aggregation, ESI/log source fusion, transit/confirmation/conflict rules, signature paste
  parsing display logic, decay timers, module registry
  enable/disable/teardown, extension-point compatibility, layout profile serialization, and event
  handlers (given event payload → expected cache patch).
- **Component/E2E (Playwright against `vite dev` in browser mode, Tauri APIs mocked):** login
  state machine (mock deep link), regional fleet-map interactions, out-of-order/reconnect event
  scenarios, FC alert-to-map navigation, secondary chain-map interactions, docking drag/drop, and
  popout state bridge (mock events).
- **Performance:** automated regional-map fixture with 500 markers and burst updates; assert the
  p95 websocket-receipt-to-render budget and ensure disabled intel modules add no subscriptions or
  initial-bundle code.
- **Rust log fixtures:** sanitized UTF-8/UTF-16 fixtures for session headers, jump/combat templates,
  partial lines, split multibyte writes, truncation, rotation, duplicate notifications, multiple
  characters, unknown templates, and restart offsets. Property/fuzz tests must prove malformed log
  input cannot panic the process or emit an invented location.
- **Privacy:** tests assert raw chat/combat lines, listener names, file paths, and session headers are
  absent from SQLite, outbound HTTP bodies, application logs, diagnostics, and error reporting.
- **Manual per-release checklist:** the M2–M6 acceptance criteria above, on Windows 10 + 11.

## 16. Packaging & Release (v1)

- `tauri build` → NSIS `.exe` installer, per-user install (no admin), Windows x64.
- Version: semver `0.x.y` until parity sign-off, then `1.0.0`. Rust/JS versions kept in lockstep
  by a bump script.
- Distribution: manual download from the EVEMerc website. **No auto-updater** — but keep
  `tauri-plugin-updater` config commented in `tauri.conf.json` so enabling it later is a config
  change, and have the app check `GET /api/v1/desktop/latest-version` (add tiny endpoint) to show
  a passive "new version available" link. No code download, just a notice.
- Code signing: unsigned in v1 is acceptable (SmartScreen warning documented in README);
  buy/hook an EV cert when budget allows.
- macOS/Linux: keep code portable (no win32-only APIs outside Rust `#[cfg]` guards); do not ship
  or test in v1.

## 17. Risks & Watchpoints

1. **Event payload drift** — web app evolves while desktop is built. Mitigation: OpenAPI + a
   documented event catalog in the backend repo; CI check that regenerating types produces no diff.
2. **Dockview + Svelte adapter** — dockview-core is framework-agnostic but the adapter is custom
   code. Build it in M1 with a spike; if it fights, approved fallback is `golden-layout` v2.
3. **Deep-link registration flakiness on Windows** — mitigated by the loopback fallback (§7.3).
4. **WebView2 availability** — evergreen on Win10/11 but installer must bootstrap the WebView2
   runtime (Tauri NSIS option `webviewInstallMode: downloadBootstrapper`).
5. **Popout state bridge complexity** — keep the "main window owns everything" rule; resist the
   temptation to give popouts their own websocket.
6. **Routing math location** — VERIFY early (M0) whether shortest-path runs server-side; if
   client-side in the web app today, port it and include the jump graph in the SDE snapshot.
7. **Full parity scope** — it is large. The milestone order front-loads the daily-driver loop
   (regional fleet position/status, command actions, and extensible intel) so the project is useful
   to an FC even if secondary mapping or the parity tail slips.
8. **Fleet-state correctness** — websocket reconnects, delayed events, and polling overlap can
   produce regressions or false confidence. Require server timestamps/revisions, reject older
   updates client-side, surface freshness per pilot, and reconcile immediately after reconnect.
9. **Intel extensibility erosion** — direct imports between intel, regional, and fleet modules will
   make upgrades progressively harder. Enforce module boundaries in ESLint and test a reference
   third-party-style intel module against the public `ModuleCtx` contract in CI.
10. **EVE log format drift** — localization or client updates may change templates and encoding.
    Version parsers, match only proven templates, keep sanitized fixtures per supported locale, and
    degrade to unknown diagnostics rather than emitting a guessed observation.
11. **Log privacy leakage** — chat and combat logs contain sensitive player information. Keep raw
    text local and ephemeral, require channel allowlists, redact diagnostics structurally, and test
    every outbound boundary. No future intel feature may silently broaden collection or upload.
12. **Rotation/replay errors** — thousands of historical files and a new file per login can create
    false live events. Start at EOF, persist byte offsets/fingerprints, bind sessions to authenticated
    characters, and test create/rename/truncate/restart behavior on Windows.

---

## Appendix A — API v1 Endpoint Inventory

Every operation the desktop needs, mapped from today's web routes (`routes/web.php` + existing
`routes/api.php`). All under `/api/v1`, `auth:sanctum` unless marked public. Reuse the named
Actions/FormRequests/Resources that the web controllers already use.

**Auth & account**
| Method | Path | Source of behavior |
|---|---|---|
| POST | `/auth/token` | new (§5.2) |
| DELETE | `/auth/token` | new (logout/revoke) |
| GET | `/me` | `HandleInertiaRequests` shared props (user, characters, statuses, scopes) |
| GET/POST/DELETE | `/tokens` | `TokenManagementController` |
| PUT | `/user-characters/{character}` | `UserCharacterController@update` |
| DELETE | `/user-characters/{character}` | `UserCharacterController@delete` |
| POST | `/preferred-character/{character}` | `PreferredCharacterController` |
| GET | `/scopes` | `ScopeController@index` (list per-char scopes) |
| DELETE | `/scopes/{character}` | `ScopeController@destroy` |
| GET | `/desktop/latest-version` | new (§16) |

**Maps & settings**
| Method | Path | Source |
|---|---|---|
| GET | `/maps` | `MapController@index` (map cards) |
| POST | `/maps` | `CreateMapAction` via `StoreMapRequest` |
| GET | `/maps/{map}` | `MapController@show` payload (map + systems + connections + …) |
| PUT | `/maps/{map}` | `UpdateMapAction` |
| DELETE | `/maps/{map}` | `MapController@destroy` |
| GET | `/maps/{map}/ping` | `PingController@show` |
| POST | `/maps/{map}/settings/toggle-public` | `MapSettingsController` |
| POST | `/maps/{map}/settings/generate-share-token` | 〃 |
| DELETE | `/maps/{map}/settings/revoke-share-token` | 〃 |
| POST | `/maps/{map}/settings/home-system` | `HomeSystemController` |
| POST | `/maps/{map}/settings/rally-point` | `RallyPointController` |
| GET | `/maps/{map}/access` | `MapAccessController@show` |
| POST | `/maps/{map}/access` | `MapAccessController@store` |
| GET | `/maps/{map}/routing-settings` | `MapRoutingSettingsController@show` |
| PUT | `/maps/{map}/user-settings` | `MapUserSettingController@update` |
| GET | `/share/{token}` | `MapController@showByToken` (public, read-only) |

**Canvas: systems, connections, selection**
| Method | Path | Source |
|---|---|---|
| POST/PUT/DELETE | `/map-solarsystems[/{id}]` | `MapSolarsystemController` + Store/Update actions |
| POST/PUT/DELETE | `/map-connections[/{id}]` | `MapConnectionController` + actions |
| PUT | `/map-selection` | `MapSelectionController@update` (bulk move) |
| DELETE | `/map-selection` | `MapSelectionController@destroy` (bulk delete) |
| POST | `/eve-scout-connections` | `EveScoutConnectionController` |

**Signatures**
| Method | Path | Source |
|---|---|---|
| POST | `/map-solarsystems/{id}/signatures` | `SignatureController@store` |
| PUT/DELETE | `/signatures/{id}` | `SignatureController` (shallow) |
| POST | `/paste-signatures` | `PasteSignatureController` (raw clipboard text in body) |
| DELETE | `/map-solarsystems/{id}/signatures` | `BulkSignatureController@destroy` |

**Tracking, navigation, waypoints**
| Method | Path | Source |
|---|---|---|
| POST | `/tracking` | `TrackingController@store` (toggle) |
| POST | `/location-observations` | new (§5.8; normalized gamelog-derived position only) |
| POST | `/waypoints` | `WaypointController` (ESI set destination) |
| POST | `/waypoints/bulk` | `BulkWaypointController` |
| POST/PUT/DELETE | `/map-route-solarsystems[/{id}]` | `MapRouteSolarsystemController` |
| POST | `/ignore-systems` | `IgnoreListController@store` |
| DELETE | `/ignore-system/{solarsystemId}` | `IgnoreListController@destroy` |
| DELETE | `/ignore-systems` | `IgnoreListController@destroyAll` |
| POST | `/statistics` | `StatisticsController@store` |

**Fleet**
| Method | Path | Source |
|---|---|---|
| POST | `/maps/{map}/fleet/register` | `FleetController` |
| DELETE | `/maps/{map}/fleet/deregister` | 〃 |
| GET | `/maps/{map}/fleet/status` | 〃 |
| POST | `/maps/{map}/fleet/waypoint` | `FleetWaypointController` |
| POST | `/maps/{map}/fleet/commanders` | `FleetCommanderController@store` |
| DELETE | `/maps/{map}/fleet/commanders/{commander}` | `FleetCommanderController@destroy` |

**Intel, regional, locations, static**
| Method | Path | Source |
|---|---|---|
| GET | `/regions` | public — `RegionalMapController@regions` |
| GET | `/maps/{map}/region/{region}` | `RegionalMapController@show` |
| GET | `/zkillboard/system/{id}/kills` | `ZKillboardController@recentKills` |
| GET | `/maps/{map}/fleet-kills` | `ZKillboardController@fleetKills` |
| GET | `/system/{id}/jumps` | `ZKillboardController@systemJumps` |
| GET | `/system/{id}/stats24h` | `ZKillboardController@systemKillStats24h` |
| GET | `/system/{id}/sov-structures` | public — `SovereigntyController@forSystem` |
| GET | `/sovereignties` | public — existing api route |
| POST | `/maps/{map}/saved-locations` | `MapSavedLocationController@store` |
| DELETE | `/maps/{map}/saved-locations/{id}` | `MapSavedLocationController@destroy` |
| GET | `/sde/version`, `/sde/snapshot` | new (§5.5) |
| POST | `/broadcasting/auth` | §5.3 |

## Appendix B — Coding Conventions for the Implementer (GPT)

1. **TypeScript strict** everywhere; `any` is forbidden; API types come only from `schema.d.ts`.
2. **Svelte 5 runes syntax only**: `$state`, `$derived`, `$effect`, `$props()`. No `export let`,
   no legacy `$:` reactive statements, no Svelte 4 stores except for the documented cross-window
   bridge. Components are `.svelte`; shared reactive state lives in `.svelte.ts` files.
3. One module = one folder; modules never import from each other — shared code goes to
   `lib/components` / `lib/utils`. Enforce with an ESLint boundary rule.
4. Every network call goes through `lib/api/client.ts`; every WS event through a handler in
   `lib/realtime/handlers/`. Components never call `fetch` or Echo directly.
5. Keep Rust boring: no business logic, no state beyond what §6 lists.
6. Match names to the backend: a `MapSolarsystem` is a `MapSolarsystem` everywhere — do not
   invent synonyms (nodes, pins, markers) in code.
7. Small PRs per milestone task; each PR includes its vitest coverage; CI must stay green
   (`svelte-check`, eslint, vitest, `cargo clippy -D warnings`).
8. When the web app's behavior is ambiguous, read the Vue source in the backend repo
   (`resources/js/`) and port the behavior — never guess. If still ambiguous, ask the owner.

## Appendix C — Backend Task Checklist (do these in the Laravel repo)

- [ ] `api/v1` route group per Appendix A, controllers delegating to existing Actions/Policies
- [x] PKCE auth bridge: `/auth/desktop/start`, one-time code issue in `EveController@store`
      (`/eve/callback`), `POST/DELETE /api/v1/auth/token`, `GET /api/v1/me`
- [x] Sanctum-protected broadcasting authorization at `/api/v1/broadcasting/auth`
- [ ] Scribe annotations + `scribe:generate` → `openapi.yaml` CI artifact
- [ ] Event catalog doc: `broadcastAs()` name + payload Resource for every event in §8.2
- [ ] Fleet operational-state contract (§5.7): revisioned reconciliation snapshot, timestamped
      member position/status payloads, documented ESI observation cadence, and out-of-order-event tests
- [x] Log-derived location observations (§5.8): owned-character validation, deduplication,
      timestamp/source arbitration, rate limiting, revisioned broadcast, and privacy-boundary tests
- [ ] `sde:build-snapshot` artisan command + `/sde/version` + `/sde/snapshot` endpoints
- [ ] `GET /api/v1/desktop/latest-version`
- [ ] Pest feature tests for all of the above (happy/failure/expiry/authorization paths)
