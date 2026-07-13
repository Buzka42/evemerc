# Graph Report - .  (2026-07-13)

## Corpus Check
- 117 files · ~52,250 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 502 nodes · 608 edges · 60 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Panel Window Management|Panel Window Management]]
- [[_COMMUNITY_API Client & PKCE Auth Flow|API Client & PKCE Auth Flow]]
- [[_COMMUNITY_Fleet Command UI & Docking|Fleet Command UI & Docking]]
- [[_COMMUNITY_Panel Bridge & Regional Map Model|Panel Bridge & Regional Map Model]]
- [[_COMMUNITY_Rust Command Surface|Rust Command Surface]]
- [[_COMMUNITY_SDE Rust Backend Queries|SDE Rust Backend Queries]]
- [[_COMMUNITY_SDE TypeScript Bridge|SDE TypeScript Bridge]]
- [[_COMMUNITY_Account API & App Root|Account API & App Root]]
- [[_COMMUNITY_Module Registry Core|Module Registry Core]]
- [[_COMMUNITY_Feature Module Manifests|Feature Module Manifests]]
- [[_COMMUNITY_Auth Token Storage (Rust + TS)|Auth Token Storage (Rust + TS)]]
- [[_COMMUNITY_Fleet Actions (RegisterWaypointCommanders)|Fleet Actions (Register/Waypoint/Commanders)]]
- [[_COMMUNITY_Dockview Workspace Adapter|Dockview Workspace Adapter]]
- [[_COMMUNITY_AccountCharacterToken API|Account/Character/Token API]]
- [[_COMMUNITY_Map Routing Settings API|Map Routing Settings API]]
- [[_COMMUNITY_Route Planning & Ignore List API|Route Planning & Ignore List API]]
- [[_COMMUNITY_Offline Cache (Rust)|Offline Cache (Rust)]]
- [[_COMMUNITY_Fleet Alerts & Freshness|Fleet Alerts & Freshness]]
- [[_COMMUNITY_Fleet Killfeed (zKillboard)|Fleet Killfeed (zKillboard)]]
- [[_COMMUNITY_EVE Log Line Parser (Rust)|EVE Log Line Parser (Rust)]]
- [[_COMMUNITY_Realtime Events & Map Settings|Realtime Events & Map Settings]]
- [[_COMMUNITY_Fleet Snapshot Reconciliation|Fleet Snapshot Reconciliation]]
- [[_COMMUNITY_System Intel API|System Intel API]]
- [[_COMMUNITY_Layout Profiles|Layout Profiles]]
- [[_COMMUNITY_Realtime EchoReverb Connection|Realtime Echo/Reverb Connection]]
- [[_COMMUNITY_EVE Log Telemetry Bridge (TS)|EVE Log Telemetry Bridge (TS)]]
- [[_COMMUNITY_AuditsSelected System API|Audits/Selected System API]]
- [[_COMMUNITY_Local JumpLocation Fusion|Local Jump/Location Fusion]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]

## God Nodes (most connected - your core abstractions)
1. `ModuleRegistry` - 16 edges
2. `MemoryAccessTokenStore` - 10 edges
3. `createEveMercApi()` - 8 edges
4. `parseProbeScanner()` - 8 edges
5. `Tauri App Bootstrap (lib.rs run())` - 8 edges
6. `sync_sde_snapshot()` - 7 edges
7. `createModuleRegistry` - 7 edges
8. `EVEMerc Desktop Full Rebuild Plan` - 7 edges
9. `DesktopAuthFlow` - 6 edges
10. `createPkceAttempt()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Rationale: Revision-Ordered Fleet State, Never Overwrite Newer Data` --rationale_for--> `EveLogService (eve_logs/mod.rs)`  [INFERRED]
  PLAN.md → src-tauri/src/eve_logs/mod.rs
- `Jump Line Parser (eve_logs/parser.rs)` --implements--> `Local EVE Log Ingestion Spec`  [AMBIGUOUS]
  src-tauri/src/eve_logs/parser.rs → PLAN.md
- `Rationale: Raw Log Text Stays Local` --rationale_for--> `TailState Log Tailer (eve_logs/tailer.rs)`  [INFERRED]
  PLAN.md → src-tauri/src/eve_logs/tailer.rs
- `PanelWindow.svelte Component` --shares_data_with--> `App HTML Entry (index.html)`  [INFERRED]
  src/windows/PanelWindow.svelte → index.html
- `Rationale: Hybrid Backend Model with Local SQLite Cache` --rationale_for--> `Offline Cache Commands (cache.rs)`  [INFERRED]
  PLAN.md → src-tauri/src/cache.rs

## Hyperedges (group relationships)
- **Desktop PKCE OAuth Login Flow** — auth_pkce, auth_flow, app_svelte_login [EXTRACTED 0.90]
- **OpenAPI-to-Typed-Client Generation Pipeline** — sync_api_script, api_schema, api_client [EXTRACTED 0.85]
- **Offline-First Fleet Workspace Load** — cache_bridge, app_svelte_load_fleet_workspace, app_svelte_ensure_realtime [INFERRED 0.70]
- **Defensive tolerant-parsing pattern for external/API data** — killfeed_normalizeFleetKills, system_normalizeSystemIntel, choices_fetchMapChoices, status_fetchFleetSnapshot [INFERRED 0.75]
- **Fleet member location freshness and alerting flow** — freshness_memberFreshness, alerts_fleetAlerts, localJump_applyLocationObservation, status_FleetMember [INFERRED 0.80]
- **Dock layout and panel window management system** — dock_createDockWorkspace, profiles_LayoutProfile, windows_openPanelWindow, panelBridge_PanelWindowState [INFERRED 0.70]
- **Feature module registration and gating pattern** — registry_ModuleRegistry, index_createModuleRegistry, types_FeatureModule, fleet_index_fleetModule, local_telemetry_index_localTelemetryModule, regional_index_regionalModule, reference_intel_index_referenceIntelModule, wormhole_map_index_wormholeMapModule [EXTRACTED 0.90]
- **Reverb/Echo realtime event dispatch and payload normalization** — echo_connectFleetRealtime, fleetEvents_fleetSnapshotFromEvent, serverStatus_serverStatusFromEvent [INFERRED 0.75]
- **Kill activity intel overlay data flow into regional map model** — provider_loadKillActivityLayer, model_buildRegionalMapModel, types_RegionalLayerData [INFERRED 0.85]
- **Tauri invoke() Bridge Pattern with Browser Fallback** — sde_bridge_syncsdesnapshot, sde_bridge_resolvesolarsystem, telemetry_evelogs_starteveslogwatcher, telemetry_evelogs_geteveslogstatus [INFERRED 0.85]
- **EVE Log to Location Observation Pipeline** — telemetry_evelogs_oneveslogobservation, telemetry_fusion_jumpobservationsubmission, telemetry_publisher_publishevelogobservation, sde_bridge_resolvesolarsystem [INFERRED 0.85]
- **Wormhole Chain Map CRUD Operations** — wormhole_api_createchainsystem, wormhole_api_createchainconnection, wormhole_api_movechainsystem, wormhole_api_pastesignatures, wormhole_api_tracktransition [EXTRACTED 1.00]
- **PKCE Desktop Authentication Flow** — auth_commands, plan_auth_spec, openapi_spec [INFERRED 0.70]
- **EVE Log Discovery-Tail-Decode-Parse Pipeline** — eve_logs_discovery, eve_logs_tailer, eve_logs_decoder, eve_logs_parser, eve_logs_service [INFERRED 0.90]
- **Popout Panel Window Architecture** — panelwindow_component, windows_commands, plan_windowing_spec [INFERRED 0.75]

## Communities (83 total, 39 thin omitted)

### Community 0 - "Panel Window Management"
Cohesion: 0.08
Nodes (25): open_panel_window(), decode_chunk(), decode_utf16(), decode_utf8(), decodes_utf16_little_endian_with_a_split_code_unit(), detect_encoding(), LogEncoding, preserves_an_incomplete_utf8_character_between_chunks() (+17 more)

### Community 1 - "API Client & PKCE Auth Flow"
Cohesion: 0.09
Nodes (19): createEveMercApi(), MemoryAccessTokenStore, authRedirectUri(), DesktopAuthFlow, deviceName(), assertAllowedServerUrl(), createPkceAttempt(), desktopAuthUrl() (+11 more)

### Community 2 - "Fleet Command UI & Docking"
Cohesion: 0.06
Nodes (36): setFleetWaypoint, fleetAlerts, fleet alert rules test, fetchMapChoices, ExistingElementRenderer class, createDockWorkspace, loadProfile (dock), memberFreshness (+28 more)

### Community 3 - "Panel Bridge & Regional Map Model"
Cohesion: 0.08
Nodes (17): buildRegionalMapModel(), RegionMap.svelte Component, securityColor function, RegionTopology interface, SignatureCatalogEntry interface (sde/bridge), SolarSystemDetails interface, enrichChainSnapshot(), moveChainSystem() (+9 more)

### Community 4 - "Rust Command Surface"
Cohesion: 0.11
Nodes (29): Auth Commands (commands/auth.rs), Tauri Build Script (build.rs), Offline Cache Commands (cache.rs), Commands Module Declarations (commands/mod.rs), EVE Log Watcher Commands (commands/eve_logs.rs), BOM-aware Log Decoder (eve_logs/decoder.rs), EVE Logs Discovery (eve_logs/discovery.rs), Jump Line Parser (eve_logs/parser.rs) (+21 more)

### Community 5 - "SDE Rust Backend Queries"
Cohesion: 0.11
Nodes (23): get_region_topology(), get_signature_catalog(), get_solar_system_details(), loads_only_the_requested_region_topology(), local_version(), read_region_topology(), read_signature_catalog(), read_solar_system_details() (+15 more)

### Community 6 - "SDE TypeScript Bridge"
Cohesion: 0.14
Nodes (16): getSignatureCatalog(), resolveSolarSystem(), syncSdeSnapshot(), EveLogObservation interface, getEveLogStatus function, startEveLogWatcher function, EVE log telemetry browser fallback test, compareObservations() (+8 more)

### Community 7 - "Account API & App Root"
Cohesion: 0.1
Nodes (20): Account API Module, Account API Test, EveMerc API Client, API Client Test, Generated OpenAPI Schema Types, App.svelte Root Component, loadFleetWorkspace(), Audits API Module (+12 more)

### Community 9 - "Feature Module Manifests"
Cohesion: 0.12
Nodes (17): fleetSnapshotFromEvent, fleet realtime events test suite, fleetModule (Fleet Command), createModuleRegistry, default module registry test suite, localTelemetryModule, buildRegionalMapModel, regional map performance test suite (+9 more)

### Community 10 - "Auth Token Storage (Rust + TS)"
Cohesion: 0.22
Nodes (8): clear_access_token(), device_name(), load_access_token(), request_target(), start_loopback_auth_listener(), store_access_token(), token_account(), token_entry()

### Community 11 - "Fleet Actions (Register/Waypoint/Commanders)"
Cohesion: 0.26
Nodes (8): apiMessage(), appointFleetCommander(), deregisterFleet(), registerFleet(), removeFleetCommander(), setFleetWaypoint(), configureServer(), if()

### Community 12 - "Dockview Workspace Adapter"
Cohesion: 0.2
Nodes (3): ExistingElementRenderer, run(), main()

### Community 13 - "Account/Character/Token API"
Cohesion: 0.28
Nodes (4): charactersFrom(), fetchAccountCharacters(), fetchAccountTokens(), tokensFrom()

### Community 14 - "Map Routing Settings API"
Cohesion: 0.33
Nodes (5): fetchMapRoutingSettings(), generateMapShareToken(), normalizeMapRoutingSettings(), record(), toggleMapPublic()

### Community 15 - "Route Planning & Ignore List API"
Cohesion: 0.31
Nodes (6): addIgnoredSystem(), fetchIgnoredSystems(), idsFrom(), parseRouteSystemIds(), removeIgnoredSystem(), route system input test

### Community 16 - "Offline Cache (Rust)"
Cohesion: 0.44
Nodes (8): cache_get(), cache_purge_server(), cache_put(), cache_records_are_isolated_by_server_and_namespace(), get_record(), open_cache(), open_cache_path(), put_record()

### Community 18 - "Fleet Killfeed (zKillboard)"
Cohesion: 0.47
Nodes (3): fetchFleetKills(), normalizeFleetKills(), zkillUrl()

### Community 19 - "EVE Log Line Parser (Rust)"
Cohesion: 0.4
Nodes (4): EveLogObservation, EveLogObservationKind, parse_line(), parses_an_english_jump_notification_without_exposing_the_raw_line()

### Community 20 - "Realtime Events & Map Settings"
Cohesion: 0.33
Nodes (6): connectFleetRealtime, FleetMembersUpdatedPayload interface, serverStatusFromEvent, server status events test suite, fetchMapRoutingSettings, normalizeMapRoutingSettings

### Community 22 - "System Intel API"
Cohesion: 0.6
Nodes (3): fetchSystemIntel(), normalizeSystemIntel(), numberOrNull()

### Community 32 - "Community 32"
Cohesion: 0.5
Nodes (4): checkLatestVersion function, DesktopRelease interface, isNewerVersion function, desktop release comparison test

## Ambiguous Edges - Review These
- `Jump Line Parser (eve_logs/parser.rs)` → `Local EVE Log Ingestion Spec`  [AMBIGUOUS]
  src-tauri/src/eve_logs/parser.rs · relation: implements

## Knowledge Gaps
- **95 isolated node(s):** `RemoteVersion`, `SdeStatus`, `RegionSystem`, `RegionJump`, `RegionTopology` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Jump Line Parser (eve_logs/parser.rs)` and `Local EVE Log Ingestion Spec`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **Why does `MemoryAccessTokenStore` connect `API Client & PKCE Auth Flow` to `Auth Token Storage (Rust + TS)`, `SDE TypeScript Bridge`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `sync_sde_snapshot()` connect `SDE Rust Backend Queries` to `Panel Window Management`, `Auth Token Storage (Rust + TS)`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `fetchChainSnapshot()` connect `API Client & PKCE Auth Flow` to `Panel Bridge & Regional Map Model`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `parseProbeScanner()` (e.g. with `pasteSignatures()` and `getSignatureCatalog()`) actually correct?**
  _`parseProbeScanner()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RemoteVersion`, `SdeStatus`, `RegionSystem` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Panel Window Management` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._