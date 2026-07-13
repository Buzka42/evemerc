<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { isTauri } from '@tauri-apps/api/core';
  import { DesktopAuthFlow, listenForAuthCallbacks, type AuthFlowState } from './lib/auth/flow';
  import { KeyringAccessTokenStore } from './lib/auth/tokenStore';
  import { createEveMercApi } from './lib/api/client';
  import { fetchFleetSnapshot, reconcileFleetSnapshot, type FleetSnapshot } from './lib/fleet/status';
  import { fetchMapChoices, type MapChoice } from './lib/maps/choices';
  import { getRegionTopology, getSignatureCatalog, getSolarSystemDetails, syncSdeSnapshot, type RegionTopology, type SignatureCatalogEntry } from './lib/sde/bridge';
  import { fetchRegions, type RegionChoice } from './lib/regional/regions';
  import { publishEveLogObservation } from './lib/telemetry/publisher';
  import { connectFleetRealtime, type ConnectionState } from './lib/realtime/echo';
  import { fleetSnapshotFromEvent } from './lib/realtime/fleetEvents';
  import { purgeServerCache, readCache, writeCache } from './lib/cache/bridge';
  import RegionMap from './lib/regional/RegionMap.svelte';
  import { loadSettings, saveSettings, type DesktopSettings } from './lib/settings/store';
  import { assertAllowedServerUrl, normalizeServerUrl } from './lib/auth/pkce';
  import { createModuleRegistry } from './lib/modules';
  import type { RegionalLayerData } from './lib/modules/types';
  import FleetMemberList from './lib/fleet/FleetMemberList.svelte';
  import { applyLocalJump, applyLocationObservation } from './lib/fleet/localJump';
  import { appointFleetCommander, deregisterFleet, registerFleet, removeFleetCommander, setFleetWaypoint } from './lib/fleet/actions';
  import { fleetAlerts } from './lib/fleet/alerts';
  import FleetAlertsPanel from './lib/fleet/FleetAlertsPanel.svelte';
  import FleetCommandActions from './lib/fleet/FleetCommandActions.svelte';
  import { createChainConnection, createChainSystem, deleteAllSignatures, deleteChainConnection, deleteMapLocation, deleteSignature, enrichChainSnapshot, fetchChainSnapshot, fetchMapStatistics, importEveScoutConnections, moveChainSystem, pasteSignatures, saveMapLocation, setHomeSystem, setRallyPoint, trackTransition, updateChainConnection, updateSignature, type MapStatistics } from './lib/wormhole/api';
  import type { ChainConnectionUpdate, SignatureUpdate } from './lib/wormhole/types';
  import ConnectionEditor from './lib/wormhole/ConnectionEditor.svelte';
  import SignatureList from './lib/wormhole/SignatureList.svelte';
  import HomeRallyControls from './lib/wormhole/HomeRallyControls.svelte';
  import SavedLocationsPanel from './lib/wormhole/SavedLocationsPanel.svelte';
  import { parseProbeScanner } from './lib/wormhole/signatureParser';
  import type { ChainSnapshot } from './lib/wormhole/types';
  import WormholeChain from './lib/wormhole/WormholeChain.svelte';
  import ChainEditToolbar from './lib/wormhole/ChainEditToolbar.svelte';
  import { createAccountToken, deleteAccountToken, fetchAccountCharacters, fetchAccountTokens, removeCharacter, revokeCharacterScopes, setPreferredCharacter, type AccountCharacter, type AccountToken } from './lib/account/api';
  import AccountPanel from './lib/account/AccountPanel.svelte';
  import { defaultLayoutProfiles, panelVisible, type LayoutProfile } from './lib/layout/profiles';
  import { controlMainWindow, openPanelWindow } from './lib/layout/windows';
  import { onPanelStateRequest, publishPanelState } from './lib/layout/panelBridge';
  import { filterPaletteCommands, type CommandId } from './lib/commands/palette';
  import { checkLatestVersion, type DesktopRelease } from './lib/release/check';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import type { TranquilityStatus } from './lib/realtime/serverStatus';
  import { createDockWorkspace, type DockWorkspace } from './lib/layout/dock';
  import { fetchSystemIntel, type SystemIntel } from './lib/intel/system';
  import SelectedSystemIntel from './lib/intel/SelectedSystemIntel.svelte';
  import { fetchSelectedSystemDetails, type SelectedSystemDetails } from './lib/audits/api';
  import MapActivityLog from './lib/audits/MapActivityLog.svelte';
  import { fetchFleetKills, type FleetKill } from './lib/intel/killfeed';
  import FleetKillfeed from './lib/intel/FleetKillfeed.svelte';
  import FleetCommanders from './lib/fleet/FleetCommanders.svelte';
  import { addIgnoredSystem, fetchIgnoredSystems, parseRouteSystemIds, removeIgnoredSystem, sendRouteWaypoints } from './lib/routing/api';
  import { deleteMap, fetchMapRoutingSettings, generateMapShareToken, renameMap, revokeMapShareToken, toggleMapPublic, updateMapRoutingSettings, type MapRoutingSettings } from './lib/maps/settings';
  import { fetchMapAccess, setMapAccess, type EntityType, type MapAccessList, type MapPermission } from './lib/maps/access';
  import MapAccessPanel from './lib/maps/MapAccessPanel.svelte';
  import IgnoreListPanel from './lib/routing/IgnoreListPanel.svelte';
  import MapRoutingPanel from './lib/maps/MapRoutingPanel.svelte';
  import {
    onEveLogObservation,
    startEveLogWatcher,
    type EveLogObservation,
    type EveLogStatus,
  } from './lib/telemetry/eveLogs';
  import TelemetryStatus from './lib/telemetry/TelemetryStatus.svelte';

  const foundations = [
    'Regional fleet command workspace',
    'Realtime ESI + EVE log location fusion',
    'Extensible intel module registry',
  ];

  let logStatus = $state<EveLogStatus | null>(null);
  let lastObservation = $state<EveLogObservation | null>(null);
  let watcherError = $state<string | null>(null);
  let authState = $state<AuthFlowState>({ phase: 'idle' });
  let maps = $state<MapChoice[]>([]);
  let selectedMapSlug = $state('');
  let fleetSnapshot = $state<FleetSnapshot | null>(null);
  let fleetError = $state<string | null>(null);
  let sdeReady = $state(false);
  let connectionState = $state<ConnectionState>('offline');
  let showingCachedFleet = $state(false);
  let regionTopology = $state<RegionTopology | null>(null);
  let regions = $state<RegionChoice[]>([]);
  let selectedRegionId = $state<number | null>(null);
  let serverUrl = $state('https://wormhole.systems');
  let settings = $state<DesktopSettings | null>(null);
  let waypointSystemId = $state('');
  let commandMessage = $state<string | null>(null);
  let objectiveSystemId = $state<number | null>(null);
  let regionalLayers = $state<RegionalLayerData[]>([]);
  let commanderCharacterId = $state('');
  let chainSnapshot = $state<ChainSnapshot | null>(null);
  let selectedChainSystemId = $state<number | null>(null);
  let selectedConnectionId = $state<number | null>(null);
  let newChainSystemId = $state('');
  let connectionFromId = $state('');
  let connectionToId = $state('');
  let signaturePaste = $state('');
  let trackedDestinationId = $state('');
  let chainError = $state<string | null>(null);
  let signatureCatalog = $state<SignatureCatalogEntry[]>([]);
  let mapStatistics = $state<MapStatistics | null>(null);
  let savedLocationSystemId = $state('');
  let savedLocationNote = $state('');
  let eveLogsRoot = $state('');
  let moduleRevision = $state(0);
  let accountCharacters = $state<AccountCharacter[]>([]);
  let accountError = $state<string | null>(null);
  let accountTokens = $state<AccountToken[]>([]);
  let newTokenName = $state('');
  let createdTokenSecret = $state<string | null>(null);
  let activeLayout = $state<LayoutProfile>(defaultLayoutProfiles[0]);
  let paletteOpen = $state(false);
  let paletteQuery = $state('');
  let availableRelease = $state<DesktopRelease | null>(null);
  let tranquilityStatus = $state<TranquilityStatus | null>(null);
  let selectedRegionalSystemId = $state<number | null>(null);
  let selectedSystemIntel = $state<SystemIntel | null>(null);
  let systemIntelError = $state<string | null>(null);
  let currentTheme = $state<'dark' | 'light' | 'system'>('dark');
  let currentDensity = $state<'comfortable' | 'compact'>('comfortable');
  let selectedSystemDetails = $state<SelectedSystemDetails | null>(null);
  let fleetKills = $state<FleetKill[]>([]);
  let killfeedError = $state<string | null>(null);
  let ignoredSystemIds = $state<number[]>([]);
  let ignoreListInput = $state('');
  let routeSystemInput = $state('');
  let mapRoutingSettings = $state<MapRoutingSettings | null>(null);
  let mapSettingsMessage = $state<string | null>(null);
  let mapAccess = $state<MapAccessList | null>(null);
  let mapAccessMessage = $state<string | null>(null);
  let realtimeMapId: number | null = null;
  let disconnectRealtime: () => void = () => {};
  let chainRefreshTimer: number | null = null;
  let panelPublishTimer: number | null = null;
  let workspaceRefreshTimer: number | null = null;
  let dockHost: HTMLElement;
  let dockSource: HTMLElement;
  let dockWorkspace: DockWorkspace | null = null;
  let tokenStore = new KeyringAccessTokenStore('https://wormhole.systems');
  let api = createEveMercApi({ baseUrl: 'https://wormhole.systems', tokenStore });
  let authFlow = createAuthFlow();
  const moduleRegistry = createModuleRegistry();

  function schedulePanelStatePublish(): void {
    if (panelPublishTimer !== null) window.clearTimeout(panelPublishTimer);
    panelPublishTimer = window.setTimeout(() => {
      panelPublishTimer = null;
      void publishPanelState({
        selectedMapSlug,
        connectionState,
        objectiveSystemId,
        fleetSnapshot,
        regionTopology,
        regionalLayers,
        chainSnapshot,
        selectedChainSystemId,
        accountCharacters,
        updatedAt: new Date().toISOString(),
      });
    }, 16);
  }

  $effect(() => {
    selectedMapSlug;
    connectionState;
    objectiveSystemId;
    fleetSnapshot;
    regionTopology;
    regionalLayers;
    chainSnapshot;
    selectedChainSystemId;
    accountCharacters;
    schedulePanelStatePublish();
  });

  function createAuthFlow(): DesktopAuthFlow {
    return new DesktopAuthFlow({
      serverUrl,
      tokenStore,
      onStateChange: (state) => {
      authState = state;
      if (state.phase === 'authenticated') {
        void loadFleetWorkspace();
      }
      },
    });
  }

  function configureServer(value: string): void {
    assertAllowedServerUrl(value);
    serverUrl = normalizeServerUrl(value);
    tokenStore = new KeyringAccessTokenStore(serverUrl);
    api = createEveMercApi({ baseUrl: serverUrl, tokenStore });
    authFlow = createAuthFlow();
  }

  async function toggleModule(moduleId: string): Promise<void> {
    const module = moduleRegistry.modules().find((candidate) => candidate.id === moduleId);
    if (!module || module.core) {
      return;
    }

    if (moduleRegistry.isEnabled(moduleId)) {
      moduleRegistry.disable(moduleId);
    } else {
      moduleRegistry.enable(moduleId);
    }
    moduleRevision += 1;
    await tick();
    dockWorkspace?.applyProfile(activeLayout);

    if (settings) {
      settings.enabledModules = moduleRegistry.modules()
        .filter((candidate) => moduleRegistry.isEnabled(candidate.id))
        .map((candidate) => candidate.id);
      await saveSettings(settings);
    }
    if (selectedMapSlug) {
      void loadFleetWorkspace();
    }
  }

  async function applyEveLogsRoot(): Promise<void> {
    if (settings) {
      settings.eveLogsRoot = eveLogsRoot.trim() || null;
      await saveSettings(settings);
    }
    watcherError = null;
    logStatus = await startEveLogWatcher(eveLogsRoot.trim() || undefined);
  }

  async function applyAppearance(): Promise<void> {
    const resolvedTheme = currentTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : currentTheme;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.density = currentDensity;
    if (settings) {
      settings.theme = currentTheme;
      settings.density = currentDensity;
      await saveSettings(settings);
    }
  }

  async function toggleFleetRegistration(): Promise<void> {
    if (!selectedMapSlug) return;
    commandMessage = null;
    try {
      if (fleetSnapshot?.registration) {
        await deregisterFleet(api, selectedMapSlug);
      } else {
        await registerFleet(api, selectedMapSlug);
      }
      fleetSnapshot = null;
      await loadFleetWorkspace();
    } catch (error) {
      commandMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function sendFleetWaypoint(): Promise<void> {
    const destinationId = Number(waypointSystemId);
    if (!selectedMapSlug || !Number.isInteger(destinationId)) return;
    try {
      const result = await setFleetWaypoint(api, selectedMapSlug, destinationId);
      objectiveSystemId = destinationId;
      commandMessage = `${result.destinationName} sent to ${result.characterCount} pilots.`;
    } catch (error) {
      commandMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function toggleSelectedSystemIgnored(): Promise<void> {
    if (selectedRegionalSystemId === null) return;
    try {
      ignoredSystemIds = ignoredSystemIds.includes(selectedRegionalSystemId)
        ? await removeIgnoredSystem(api, selectedRegionalSystemId)
        : await addIgnoredSystem(api, selectedRegionalSystemId);
      commandMessage = ignoredSystemIds.includes(selectedRegionalSystemId) ? 'System added to route exclusions.' : 'System removed from route exclusions.';
    } catch (error) {
      commandMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function removeIgnoredSystemById(systemId: number): Promise<void> {
    try {
      ignoredSystemIds = await removeIgnoredSystem(api, systemId);
    } catch (error) {
      commandMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function addIgnoredSystemById(): Promise<void> {
    const systemId = Number(ignoreListInput);
    if (!Number.isInteger(systemId)) return;
    try {
      ignoredSystemIds = await addIgnoredSystem(api, systemId);
      ignoreListInput = '';
    } catch (error) {
      commandMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function sendPlannedRoute(): Promise<void> {
    const route = parseRouteSystemIds(routeSystemInput).filter((id) => !ignoredSystemIds.includes(id));
    if (route.length === 0) {
      commandMessage = 'Enter at least one non-ignored solar system ID.';
      return;
    }
    try {
      const characterCount = await sendRouteWaypoints(api, route);
      objectiveSystemId = route.at(-1) ?? null;
      commandMessage = `${route.length}-system route sent to ${characterCount} characters.`;
    } catch (error) {
      commandMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function saveRoutingSettings(): Promise<void> {
    if (!mapRoutingSettings || !selectedMapSlug) return;
    try {
      await updateMapRoutingSettings(api, selectedMapSlug, mapRoutingSettings);
      mapSettingsMessage = 'Routing preferences saved.';
    } catch (error) {
      mapSettingsMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function changePublicAccess(): Promise<void> {
    if (!mapRoutingSettings || !selectedMapSlug) return;
    try {
      mapRoutingSettings.isPublic = await toggleMapPublic(api, selectedMapSlug);
      mapSettingsMessage = `Public access ${mapRoutingSettings.isPublic ? 'enabled' : 'disabled'}.`;
    } catch (error) {
      mapSettingsMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function changeShareToken(revoke: boolean): Promise<void> {
    if (!mapRoutingSettings || !selectedMapSlug) return;
    try {
      if (revoke) {
        await revokeMapShareToken(api, selectedMapSlug);
        mapRoutingSettings.shareToken = null;
      } else {
        mapRoutingSettings.shareToken = await generateMapShareToken(api, selectedMapSlug);
      }
      mapSettingsMessage = revoke ? 'Share link revoked.' : 'Share link generated.';
    } catch (error) {
      mapSettingsMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function renameCurrentMap(name: string): Promise<void> {
    if (!selectedMapSlug) return;
    try {
      await renameMap(api, selectedMapSlug, name);
      const map = maps.find((candidate) => candidate.slug === selectedMapSlug);
      if (map) map.name = name;
      mapSettingsMessage = 'Map renamed.';
    } catch (error) {
      mapSettingsMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function setSelectedMapAccess(entityId: number, entityType: EntityType, permission: MapPermission | null, expiresAt: string | null): Promise<void> {
    if (!selectedMapSlug) return;
    try {
      await setMapAccess(api, selectedMapSlug, entityId, entityType, permission, expiresAt);
      mapAccess = await fetchMapAccess(api, selectedMapSlug);
      mapAccessMessage = permission ? 'Access updated.' : 'Access revoked.';
    } catch (error) {
      mapAccessMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function deleteCurrentMap(): Promise<void> {
    if (!selectedMapSlug) return;
    const deletedSlug = selectedMapSlug;
    try {
      await deleteMap(api, deletedSlug);
      maps = maps.filter((map) => map.slug !== deletedSlug);
      selectedMapSlug = maps[0]?.slug ?? '';
      fleetSnapshot = null;
      regionTopology = null;
      regionalLayers = [];
      selectedRegionId = null;
      chainSnapshot = null;
      mapStatistics = null;
      selectedChainSystemId = null;
      selectedConnectionId = null;
      mapRoutingSettings = null;
      mapAccess = null;
      showingCachedFleet = false;
      realtimeMapId = null;
      disconnectRealtime();
      if (selectedMapSlug) {
        await loadFleetWorkspace();
      }
    } catch (error) {
      mapSettingsMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function selectRegionalSystem(systemId: number): Promise<void> {
    selectedRegionalSystemId = systemId;
    objectiveSystemId = systemId;
    try {
      systemIntelError = null;
      selectedSystemIntel = await fetchSystemIntel(api, systemId);
    } catch (error) {
      systemIntelError = error instanceof Error ? error.message : String(error);
    }
  }

  async function addCommander(): Promise<void> {
    const characterId = Number(commanderCharacterId);
    if (!selectedMapSlug || !Number.isInteger(characterId)) return;
    try {
      await appointFleetCommander(api, selectedMapSlug, characterId);
      commanderCharacterId = '';
      await loadFleetWorkspace();
    } catch (error) {
      commandMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function deleteCommander(commanderId: number): Promise<void> {
    if (!selectedMapSlug) return;
    try {
      await removeFleetCommander(api, selectedMapSlug, commanderId);
      await loadFleetWorkspace();
    } catch (error) {
      commandMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async function refreshChain(): Promise<void> {
    if (!selectedMapSlug || !moduleRegistry.isEnabled('wormhole-map')) return;
    const freshChain = await fetchChainSnapshot(api, selectedMapSlug);
    chainSnapshot = enrichChainSnapshot(freshChain, await getSolarSystemDetails(freshChain.systems.map((system) => system.solarsystemId)));
    mapStatistics = await fetchMapStatistics(api, chainSnapshot.mapId);
    selectedChainSystemId ??= chainSnapshot.systems[0]?.id ?? null;
  }

  function scheduleChainRefresh(): void {
    if (chainRefreshTimer !== null) window.clearTimeout(chainRefreshTimer);
    chainRefreshTimer = window.setTimeout(() => {
      chainRefreshTimer = null;
      void refreshChain();
    }, 150);
  }

  function scheduleWorkspaceRefresh(): void {
    if (workspaceRefreshTimer !== null) window.clearTimeout(workspaceRefreshTimer);
    workspaceRefreshTimer = window.setTimeout(() => {
      workspaceRefreshTimer = null;
      void loadFleetWorkspace();
    }, 150);
  }

  async function addChainSystem(): Promise<void> {
    const solarsystemId = Number(newChainSystemId);
    if (!chainSnapshot || !Number.isInteger(solarsystemId)) return;
    try {
      chainError = null;
      await createChainSystem(api, chainSnapshot, solarsystemId);
      newChainSystemId = '';
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function connectChainSystems(): Promise<void> {
    const fromId = Number(connectionFromId);
    const toId = Number(connectionToId);
    if (!Number.isInteger(fromId) || !Number.isInteger(toId)) return;
    try {
      chainError = null;
      await createChainConnection(api, fromId, toId);
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  function selectChainConnection(id: number): void {
    selectedConnectionId = selectedConnectionId === id ? null : id;
  }

  async function saveSelectedConnection(update: ChainConnectionUpdate): Promise<void> {
    if (selectedConnectionId === null) return;
    try {
      chainError = null;
      await updateChainConnection(api, selectedConnectionId, update);
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function deleteSelectedConnection(): Promise<void> {
    if (selectedConnectionId === null) return;
    try {
      chainError = null;
      await deleteChainConnection(api, selectedConnectionId);
      selectedConnectionId = null;
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function persistChainSystemPosition(id: number, x: number, y: number): Promise<void> {
    try {
      await moveChainSystem(api, id, x, y);
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function selectChainSystem(id: number): Promise<void> {
    selectedChainSystemId = id;
    try {
      selectedSystemDetails = await fetchSelectedSystemDetails(api, id);
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function syncSignatures(): Promise<void> {
    if (!selectedChainSystemId) return;
    try {
      chainError = null;
      await pasteSignatures(api, selectedChainSystemId, parseProbeScanner(signaturePaste, signatureCatalog));
      signaturePaste = '';
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function deleteSelectedSignature(signatureId: number): Promise<void> {
    try {
      chainError = null;
      await deleteSignature(api, signatureId);
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function deleteAllSelectedSignatures(): Promise<void> {
    if (!selectedChainSystemId) return;
    try {
      chainError = null;
      await deleteAllSignatures(api, selectedChainSystemId);
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function editSelectedSignature(signatureId: number, update: SignatureUpdate): Promise<void> {
    try {
      chainError = null;
      await updateSignature(api, signatureId, update);
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function updateHomeSystem(mapSolarsystemId: number | null): Promise<void> {
    if (!selectedMapSlug) return;
    try {
      chainError = null;
      await setHomeSystem(api, selectedMapSlug, mapSolarsystemId);
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function updateRallyPoint(solarsystemId: number | null): Promise<void> {
    if (!selectedMapSlug) return;
    try {
      chainError = null;
      await setRallyPoint(api, selectedMapSlug, solarsystemId);
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function applyTrackedTransition(): Promise<void> {
    const destinationId = Number(trackedDestinationId);
    if (!selectedChainSystemId || !Number.isInteger(destinationId)) return;
    try {
      await trackTransition(api, selectedChainSystemId, destinationId);
      trackedDestinationId = '';
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function importEveScout(system: 'Thera' | 'Turnur'): Promise<void> {
    if (!chainSnapshot) return;
    try {
      await importEveScoutConnections(api, chainSnapshot.mapId, system);
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function addSavedLocation(): Promise<void> {
    const systemId = Number(savedLocationSystemId);
    if (!selectedMapSlug || !Number.isInteger(systemId)) return;
    try {
      await saveMapLocation(api, selectedMapSlug, systemId, savedLocationNote);
      savedLocationSystemId = '';
      savedLocationNote = '';
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function removeSavedLocation(locationId: number): Promise<void> {
    if (!selectedMapSlug) return;
    try {
      await deleteMapLocation(api, selectedMapSlug, locationId);
      await refreshChain();
    } catch (error) {
      chainError = error instanceof Error ? error.message : String(error);
    }
  }

  async function login(): Promise<void> {
    try {
      configureServer(serverUrl);
      if (settings) {
        settings.serverUrl = serverUrl;
        await saveSettings(settings);
      }
      await authFlow.start();
    } catch (error) {
      authState = { phase: 'failed', message: error instanceof Error ? error.message : String(error) };
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.DELETE('/api/v1/auth/token');
    } finally {
      await tokenStore.clear();
      await purgeServerCache(serverUrl);
      disconnectRealtime();
      realtimeMapId = null;
      connectionState = 'offline';
      maps = [];
      selectedMapSlug = '';
      fleetSnapshot = null;
      regionTopology = null;
      regionalLayers = [];
      regions = [];
      selectedRegionId = null;
      chainSnapshot = null;
      fleetKills = [];
      ignoredSystemIds = [];
      mapRoutingSettings = null;
      mapAccess = null;
      mapStatistics = null;
      accountCharacters = [];
      authState = { phase: 'idle' };
    }
  }

  async function loadRegionData(mapSlug: string, regionId: number): Promise<void> {
    regionTopology = await getRegionTopology(regionId);
    regionalLayers = await Promise.all(moduleRegistry.regionalLayers().map((layer) => layer.load({
      api,
      mapSlug,
      regionId,
    })));
  }

  async function changeRegion(regionId: number): Promise<void> {
    if (!selectedMapSlug || regionId === selectedRegionId) return;
    try {
      fleetError = null;
      selectedRegionId = regionId;
      await loadRegionData(selectedMapSlug, regionId);
    } catch (error) {
      fleetError = error instanceof Error ? error.message : String(error);
    }
  }

  async function loadFleetWorkspace(): Promise<void> {
    try {
      fleetError = null;
      if (accountCharacters.length === 0) {
        [accountCharacters, accountTokens, ignoredSystemIds] = await Promise.all([
          fetchAccountCharacters(api),
          fetchAccountTokens(api),
          fetchIgnoredSystems(api),
        ]);
      }
      if (!sdeReady) {
        try {
          await syncSdeSnapshot(serverUrl);
          sdeReady = true;
          signatureCatalog = await getSignatureCatalog();
        } catch {
          sdeReady = false;
        }
      }
      if (maps.length === 0) {
        const cachedMaps = await readCache<MapChoice[]>(serverUrl, 'maps', 'all');
        if (cachedMaps) {
          maps = cachedMaps;
          selectedMapSlug = maps[0]?.slug ?? '';
        }
        try {
          const freshMaps = await fetchMapChoices(api);
          maps = freshMaps;
          void writeCache(serverUrl, 'maps', 'all', freshMaps);
        } catch (error) {
          if (maps.length === 0) {
            throw error;
          }
          connectionState = 'offline';
        }
        selectedMapSlug = maps[0]?.slug ?? '';
      }
      if (regions.length === 0) {
        try {
          regions = await fetchRegions(api);
        } catch {
          regions = [];
        }
      }
      if (selectedMapSlug) {
        mapRoutingSettings = await fetchMapRoutingSettings(api, selectedMapSlug);
        mapAccess = mapRoutingSettings.canManageAccess ? await fetchMapAccess(api, selectedMapSlug).catch(() => null) : null;
        const activeMap = maps.find((map) => map.slug === selectedMapSlug);
        if (activeMap?.defaultRegionId) {
          selectedRegionId = activeMap.defaultRegionId;
          await loadRegionData(selectedMapSlug, activeMap.defaultRegionId);
        }
        if (!fleetSnapshot) {
          const cachedSnapshot = await readCache<FleetSnapshot>(serverUrl, 'fleet', selectedMapSlug);
          if (cachedSnapshot) {
            fleetSnapshot = cachedSnapshot;
            showingCachedFleet = true;
          }
        }
        const incoming = await fetchFleetSnapshot(api, selectedMapSlug);
        fleetSnapshot = reconcileFleetSnapshot(fleetSnapshot, incoming);
        showingCachedFleet = false;
        void writeCache(serverUrl, 'fleet', selectedMapSlug, fleetSnapshot);
        await ensureRealtime(incoming.mapId);
        const [, kills] = await Promise.all([
          refreshChain(),
          fetchFleetKills(api, selectedMapSlug).catch((error) => {
            killfeedError = error instanceof Error ? error.message : String(error);
            return fleetKills;
          }),
        ]);
        fleetKills = kills;
      }
    } catch (error) {
      fleetError = error instanceof Error ? error.message : String(error);
    }
  }

  async function preferCharacter(characterId: number): Promise<void> {
    try {
      accountError = null;
      await setPreferredCharacter(api, characterId);
      accountCharacters = await fetchAccountCharacters(api);
      await loadFleetWorkspace();
    } catch (error) {
      accountError = error instanceof Error ? error.message : String(error);
    }
  }

  async function removeScopes(characterId: number): Promise<void> {
    try {
      accountError = null;
      await revokeCharacterScopes(api, characterId);
      accountCharacters = await fetchAccountCharacters(api);
    } catch (error) {
      accountError = error instanceof Error ? error.message : String(error);
    }
  }

  async function removeSelectedCharacter(characterId: number): Promise<void> {
    try {
      accountError = null;
      await removeCharacter(api, characterId);
      accountCharacters = await fetchAccountCharacters(api);
    } catch (error) {
      accountError = error instanceof Error ? error.message : String(error);
    }
  }

  async function issueToken(): Promise<void> {
    if (!newTokenName.trim()) return;
    try {
      accountError = null;
      createdTokenSecret = await createAccountToken(api, newTokenName.trim());
      newTokenName = '';
      accountTokens = await fetchAccountTokens(api);
    } catch (error) {
      accountError = error instanceof Error ? error.message : String(error);
    }
  }

  async function revokeToken(tokenId: number): Promise<void> {
    try {
      await deleteAccountToken(api, tokenId);
      accountTokens = await fetchAccountTokens(api);
    } catch (error) {
      accountError = error instanceof Error ? error.message : String(error);
    }
  }

  function selectLayout(event: Event): void {
    const profile = defaultLayoutProfiles.find((candidate) => candidate.id === (event.currentTarget as HTMLSelectElement).value);
    if (profile) {
      activeLayout = profile;
      window.localStorage.setItem('evemerc.active-layout', profile.id);
      dockWorkspace?.applyProfile(profile);
    }
  }

  async function executeCommand(commandId: CommandId): Promise<void> {
    paletteOpen = false;
    paletteQuery = '';

    if (commandId === 'refresh-workspace') {
      await loadFleetWorkspace();
      return;
    }
    if (commandId === 'popout-fleet') {
      await openPanelWindow('fleet-command');
      return;
    }
    if (commandId === 'popout-chain') {
      await openPanelWindow('wormhole-chain');
      return;
    }
    if (commandId === 'popout-account') {
      await openPanelWindow('account');
      return;
    }
    if (commandId === 'popout-telemetry') {
      await openPanelWindow('telemetry');
      return;
    }
    if (commandId === 'toggle-wormhole') {
      await toggleModule('wormhole-map');
      return;
    }

    const profileId = commandId.replace('layout-', '');
    const profile = defaultLayoutProfiles.find((candidate) => candidate.id === profileId);
    if (profile) {
      activeLayout = profile;
      window.localStorage.setItem('evemerc.active-layout', profile.id);
    }
  }

  async function ensureRealtime(mapId: number): Promise<void> {
    if (mapId === 0 || realtimeMapId === mapId) {
      return;
    }

    disconnectRealtime();
    realtimeMapId = mapId;
    connectionState = 'reconnecting';
    try {
      disconnectRealtime = await connectFleetRealtime({
        api,
        tokenStore,
        mapId,
        onConnectionState: (state) => {
          connectionState = state;
          if (state === 'connected') {
            void loadFleetWorkspace();
          }
        },
        onFleetMembersUpdated: (payload) => {
          fleetSnapshot = reconcileFleetSnapshot(
            fleetSnapshot,
            fleetSnapshotFromEvent(payload, fleetSnapshot),
          );
          showingCachedFleet = false;
          void writeCache(serverUrl, 'fleet', selectedMapSlug, fleetSnapshot);
        },
        onCharacterLocationObserved: (payload) => {
          if (fleetSnapshot) {
            fleetSnapshot = applyLocationObservation(
              fleetSnapshot,
              payload.character_id,
              payload.solar_system_id,
              payload.observed_at,
              payload.source,
              payload.state,
            );
          }
        },
        onFleetWaypointSet: (payload) => {
          objectiveSystemId = payload.destination_solarsystem_id;
          commandMessage = `${payload.destination_name} set by ${payload.set_by_character_name} for ${payload.character_count} pilots.`;
        },
        onChainInvalidated: () => {
          scheduleChainRefresh();
        },
        onWorkspaceInvalidated: scheduleWorkspaceRefresh,
        onServerStatus: (status) => {
          tranquilityStatus = status;
        },
      });
    } catch (error) {
      realtimeMapId = null;
      connectionState = 'offline';
      throw error;
    }
  }

  async function selectMap(event: Event): Promise<void> {
    selectedMapSlug = (event.currentTarget as HTMLSelectElement).value;
    fleetSnapshot = null;
    regionTopology = null;
    regionalLayers = [];
    selectedRegionId = null;
    chainSnapshot = null;
    mapStatistics = null;
    selectedChainSystemId = null;
    selectedConnectionId = null;
    showingCachedFleet = false;
    realtimeMapId = null;
    disconnectRealtime();
    await loadFleetWorkspace();
  }

  onMount(() => {
    let disposed = false;
    let unlisten: () => void = () => {};
    let unlistenAuth: () => void = () => {};
    let unlistenPanelRequest: () => void = () => {};
    const fleetPoll = window.setInterval(() => {
      if (authState.phase === 'authenticated' && selectedMapSlug) {
        void loadFleetWorkspace();
      }
    }, 10_000);
    const handleShortcut = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        paletteOpen = !paletteOpen;
      } else if (event.key === 'Escape') {
        paletteOpen = false;
      }
    };
    window.addEventListener('keydown', handleShortcut);
    activeLayout = defaultLayoutProfiles.find((profile) => profile.id === window.localStorage.getItem('evemerc.active-layout')) ?? defaultLayoutProfiles[0];
    dockWorkspace = createDockWorkspace(dockHost, dockSource, activeLayout, (moduleId) => moduleRegistry.isEnabled(moduleId));

    void (async () => {
      try {
        if (isTauri()) {
          settings = await loadSettings();
          configureServer(settings.serverUrl);
          currentTheme = settings.theme;
          currentDensity = settings.density;
          await applyAppearance();
          eveLogsRoot = settings.eveLogsRoot ?? '';
          for (const module of moduleRegistry.modules()) {
            if (!module.core && !settings.enabledModules.includes(module.id)) {
              moduleRegistry.disable(module.id);
            }
          }
          moduleRevision += 1;
          await tick();
          dockWorkspace?.applyProfile(activeLayout);
        }
        if (await tokenStore.get()) {
          authState = { phase: 'authenticated' };
          await loadFleetWorkspace();
        }
        availableRelease = await checkLatestVersion(api, '0.1.0');
        unlistenAuth = await listenForAuthCallbacks((url) => {
          void authFlow.acceptCallback(url).catch(() => undefined);
        });
        unlistenPanelRequest = await onPanelStateRequest(schedulePanelStatePublish);
        unlisten = await onEveLogObservation((observation) => {
          lastObservation = observation;
          if (authState.phase === 'authenticated') {
            void publishEveLogObservation(api, observation, (solarSystemId) => {
              if (fleetSnapshot && observation.characterId !== null) {
                fleetSnapshot = applyLocalJump(
                  fleetSnapshot,
                  observation.characterId,
                  solarSystemId,
                  observation.observedAt,
                );
              }
            }).catch((error) => {
              watcherError = error instanceof Error ? error.message : String(error);
            });
          }
          if (logStatus !== null) {
            logStatus.observationsEmitted += 1;
            logStatus.lastObservationAt = new Date().toISOString();
          }
        });
        const status = await startEveLogWatcher(settings?.eveLogsRoot ?? undefined);
        if (!disposed) {
          logStatus = status;
        }
      } catch (error) {
        if (!disposed) {
          watcherError = error instanceof Error ? error.message : String(error);
        }
      }
    })();

    return () => {
      disposed = true;
      unlisten();
      unlistenAuth();
      unlistenPanelRequest();
      window.clearInterval(fleetPoll);
      window.removeEventListener('keydown', handleShortcut);
      if (chainRefreshTimer !== null) window.clearTimeout(chainRefreshTimer);
      if (panelPublishTimer !== null) window.clearTimeout(panelPublishTimer);
      if (workspaceRefreshTimer !== null) window.clearTimeout(workspaceRefreshTimer);
      disconnectRealtime();
      dockWorkspace?.dispose();
    };
  });
</script>

<svelte:head>
  <title>EVEMerc Desktop</title>
</svelte:head>

<main class="min-h-screen bg-[radial-gradient(circle_at_top,#102a42_0%,#07111d_48%,#03070d_100%)] px-8 py-10 text-slate-100">
  {#if paletteOpen}
    <div class="fixed inset-0 z-50 flex justify-center bg-black/65 px-4 pt-[12vh]">
      <dialog open class="relative h-fit w-full max-w-xl rounded-xl border border-cyan-300/20 bg-slate-950 p-3 text-slate-100 shadow-2xl" aria-label="Command palette">
        <button aria-label="Close command palette" class="absolute right-5 top-5 text-xs text-slate-500" onclick={() => paletteOpen = false}>Esc</button>
        <input
          class="w-full rounded-md border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-300/50"
          placeholder="Type a command…"
          bind:value={paletteQuery}
        />
        <div class="mt-2 flex max-h-80 flex-col gap-1 overflow-y-auto">
          {#each filterPaletteCommands(paletteQuery) as command}
            <button class="rounded-md px-3 py-2 text-left text-sm text-slate-300 hover:bg-cyan-300/10 hover:text-cyan-100" onclick={() => executeCommand(command.id)}>{command.title}</button>
          {/each}
        </div>
      </dialog>
    </div>
  {/if}
  <section class="mx-auto flex max-w-5xl flex-col gap-8">
    <header data-tauri-drag-region class="flex items-center justify-between border-b border-cyan-400/20 pb-5">
      <div class="flex flex-col gap-1">
        <p class="text-xs font-semibold tracking-[0.28em] text-cyan-300">FLEET INTELLIGENCE PLATFORM</p>
        <h1 class="text-3xl font-semibold tracking-tight">EVEMerc Desktop</h1>
      </div>
      <div class="flex items-center gap-3">
        <button class="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-400" onclick={() => paletteOpen = true}>Commands <kbd class="ml-1 text-slate-600">Ctrl K</kbd></button>
        <select
          aria-label="Layout profile"
          class="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"
          value={activeLayout.id}
          onchange={selectLayout}
        >
          {#each defaultLayoutProfiles as profile}<option value={profile.id}>{profile.name}</option>{/each}
        </select>
        <span class="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
          {authState.phase === 'authenticated' ? 'EVE session active' : 'Local mode'}
        </span>
        {#if tranquilityStatus}
          <span class:text-amber-300={tranquilityStatus.vip} class="text-xs text-emerald-300">TQ {tranquilityStatus.vip ? 'VIP' : 'online'} · {tranquilityStatus.players.toLocaleString()}</span>
        {/if}
        {#if authState.phase !== 'authenticated'}
          <input
            class="w-52 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300"
            aria-label="EVEMerc server URL"
            bind:value={serverUrl}
          />
          <button
            class="rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:cursor-wait disabled:opacity-60"
            disabled={authState.phase === 'waiting_for_browser' || authState.phase === 'exchanging_code'}
            onclick={login}
          >
            {authState.phase === 'waiting_for_browser' ? 'Complete login in browser' : 'Log in with EVE'}
          </button>
        {:else}
          <button class="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300" onclick={logout}>
            Log out
          </button>
        {/if}
        <div class="flex items-center gap-1 border-l border-slate-700 pl-2">
          <button aria-label="Minimize window" class="px-2 py-1 text-slate-500 hover:text-slate-200" onclick={() => controlMainWindow('minimize')}>—</button>
          <button aria-label="Maximize window" class="px-2 py-1 text-slate-500 hover:text-slate-200" onclick={() => controlMainWindow('toggle-maximize')}>□</button>
          <button aria-label="Close window" class="px-2 py-1 text-slate-500 hover:text-rose-300" onclick={() => controlMainWindow('close')}>×</button>
        </div>
      </div>
    </header>

    {#if availableRelease}
      <button class="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-left text-xs text-cyan-100" onclick={() => openUrl(availableRelease?.downloadUrl ?? serverUrl)}>
        EVEMerc Desktop {availableRelease.version} is available — open download page
      </button>
    {/if}

    {#if authState.phase === 'failed'}
      <div class="rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
        {authState.message}
      </div>
    {/if}

    <div bind:this={dockHost} class="h-[calc(100vh-15rem)] min-h-[520px] overflow-hidden rounded-xl border border-cyan-300/15"></div>
    <div bind:this={dockSource} class="hidden">
      <article data-dock-panel="fleet-command" class="hidden h-full rounded-xl border border-cyan-300/15 bg-slate-950/55 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <p class="text-sm text-slate-400">Primary workspace</p>
        <div class="mt-2 flex items-center justify-between gap-4">
          <h2 class="text-2xl font-medium">Regional fleet command</h2>
          <div class="flex items-center gap-2">
            {#if regions.length > 0}
              <select
                aria-label="Region"
                class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                value={selectedRegionId ?? ''}
                onchange={(event) => changeRegion(Number((event.currentTarget as HTMLSelectElement).value))}
              >
                {#each regions as region}
                  <option value={region.id}>{region.name}</option>
                {/each}
              </select>
            {/if}
            {#if maps.length > 0}
              <select
                class="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                value={selectedMapSlug}
                onchange={selectMap}
              >
                {#each maps as map}
                  <option value={map.slug}>{map.name}</option>
                {/each}
              </select>
            {/if}
          </div>
        </div>
        <p class="mt-3 max-w-xl text-sm leading-6 text-slate-300">
          Live fleet positions, freshness, command state, and regional intel will remain at the center of every built-in layout.
        </p>
        {#if authState.phase === 'authenticated' && selectedMapSlug}
          <FleetCommandActions
            fleetLinked={Boolean(fleetSnapshot?.registration)}
            bind:waypointSystemId
            bind:routeSystemInput
            selectedSystemId={selectedRegionalSystemId}
            isSelectedSystemIgnored={selectedRegionalSystemId !== null && ignoredSystemIds.includes(selectedRegionalSystemId)}
            {commandMessage}
            onToggleRegistration={toggleFleetRegistration}
            onSendWaypoint={sendFleetWaypoint}
            onSendRoute={sendPlannedRoute}
            onToggleIgnored={toggleSelectedSystemIgnored}
          />
        {/if}
        <div class="mt-6 min-h-64 rounded-lg border border-cyan-300/20 bg-cyan-950/10 p-4">
          {#if fleetSnapshot}
            <div class="flex items-center justify-between border-b border-slate-700/70 pb-3 text-xs">
              <span>{fleetSnapshot.members.length} pilots · revision {fleetSnapshot.revision}</span>
              <div class="flex items-center gap-3">
                {#if showingCachedFleet}<span class="text-amber-300">cached</span>{/if}
                <span class:text-emerald-300={connectionState === 'connected'} class="text-slate-500">{connectionState}</span>
                <span class:text-amber-300={fleetSnapshot.freshness.isStale} class="text-emerald-300">
                  {fleetSnapshot.freshness.isStale ? 'STALE' : `${fleetSnapshot.freshness.ageSeconds ?? 0}s old`}
                </span>
              </div>
            </div>
            {#if regionTopology}
              <RegionMap
                topology={regionTopology}
                members={fleetSnapshot.members}
                highlightedSystemId={objectiveSystemId}
                layers={regionalLayers}
                onSelectSystem={selectRegionalSystem}
              />
            {/if}
            <FleetMemberList snapshot={fleetSnapshot} />
            {@const alerts = fleetAlerts(fleetSnapshot)}
            <FleetAlertsPanel {alerts} onFocusSystem={(solarSystemId) => objectiveSystemId = solarSystemId} />
            <FleetCommanders
              commanders={fleetSnapshot.commanders}
              bind:commanderCharacterId
              onAppoint={addCommander}
              onRemove={deleteCommander}
            />
            {#if fleetError}
              <p class="mt-3 text-xs text-amber-200">Live refresh failed: {fleetError}</p>
            {/if}
            <FleetKillfeed kills={fleetKills} error={killfeedError} />
          {:else if fleetError}
            <p class="text-sm text-amber-200">{fleetError}</p>
          {:else if authState.phase === 'authenticated'}
            <p class="text-sm text-slate-500">Loading the current fleet snapshot…</p>
          {:else}
            <p class="text-sm text-slate-500">Log in to load live fleet positions and command status.</p>
          {/if}
        </div>
      </article>

      <aside data-dock-panel="telemetry" class="hidden h-full flex-col gap-4 rounded-xl border border-slate-700/70 bg-slate-950/55 p-5">
        <p class="text-sm font-medium text-slate-200">Foundation status</p>
        {#each foundations as foundation}
          <div class="flex items-start gap-3 rounded-lg bg-slate-900/70 p-3">
            <span class="mt-1 size-2 rounded-full bg-cyan-300"></span>
            <span class="text-sm text-slate-300">{foundation}</span>
          </div>
        {/each}

        <div class="border-t border-slate-700/70 pt-4">
          <p class="text-xs font-semibold tracking-[0.15em] text-slate-500">MODULES</p>
          <div class="mt-3 flex flex-col gap-2">
            {#each moduleRegistry.modules() as module}
              <button
                class="flex items-center justify-between rounded-md bg-slate-900/70 px-3 py-2 text-left text-xs disabled:cursor-default"
                disabled={module.core}
                onclick={() => toggleModule(module.id)}
              >
                <span>{module.title}</span>
                <span class:text-emerald-300={moduleRegistry.isEnabled(module.id)} class="text-slate-600">
                  {module.core ? 'core' : moduleRegistry.isEnabled(module.id) ? 'on' : 'off'}
                </span>
              </button>
            {/each}
          </div>
        </div>

        <div class="border-t border-slate-700/70 pt-4">
          <p class="text-xs font-semibold tracking-[0.15em] text-slate-500">APPEARANCE</p>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <select aria-label="Color theme" class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" bind:value={currentTheme} onchange={applyAppearance}>
              <option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option>
            </select>
            <select aria-label="Interface density" class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" bind:value={currentDensity} onchange={applyAppearance}>
              <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
            </select>
          </div>
        </div>

        {#if selectedRegionalSystemId}
          <SelectedSystemIntel systemId={selectedRegionalSystemId} intel={selectedSystemIntel} error={systemIntelError} />
        {/if}

        {#if panelVisible(activeLayout, 'telemetry')}
          <TelemetryStatus
            {logStatus}
            {watcherError}
            {lastObservation}
            bind:eveLogsRoot
            onApply={applyEveLogsRoot}
          />
        {/if}
      </aside>

      <aside data-dock-panel="map-settings" class="hidden h-full flex-col gap-4 overflow-auto rounded-xl border border-slate-700/70 bg-slate-950/55 p-5">
        {#if mapRoutingSettings}
          <MapRoutingPanel
            bind:settings={mapRoutingSettings}
            message={mapSettingsMessage}
            {serverUrl}
            mapName={maps.find((map) => map.slug === selectedMapSlug)?.name ?? ''}
            onSave={saveRoutingSettings}
            onTogglePublic={changePublicAccess}
            onChangeShareToken={changeShareToken}
            onRename={renameCurrentMap}
            onDelete={deleteCurrentMap}
          />
        {/if}

        {#if mapAccess}
          <MapAccessPanel access={mapAccess} message={mapAccessMessage} onSetAccess={setSelectedMapAccess} />
        {/if}

        {#if selectedMapSlug}
          <IgnoreListPanel
            {ignoredSystemIds}
            bind:input={ignoreListInput}
            onAdd={addIgnoredSystemById}
            onRemove={removeIgnoredSystemById}
          />
        {/if}

        {#if !mapRoutingSettings && !mapAccess}
          <p class="text-sm text-slate-500">Select a map to manage its routing and access settings.</p>
        {/if}
      </aside>

      <aside data-dock-panel="account" class="hidden h-full flex-col gap-4 overflow-auto rounded-xl border border-slate-700/70 bg-slate-950/55 p-5">
        {#if authState.phase === 'authenticated'}
          <AccountPanel
            characters={accountCharacters}
            tokens={accountTokens}
            bind:newTokenName
            {createdTokenSecret}
            error={accountError}
            onRefresh={async () => accountCharacters = await fetchAccountCharacters(api)}
            onPreferCharacter={preferCharacter}
            onRemoveScopes={removeScopes}
            onRemoveCharacter={removeSelectedCharacter}
            onIssueToken={issueToken}
            onRevokeToken={revokeToken}
            onDismissSecret={() => createdTokenSecret = null}
            onAddScopes={() => openUrl(`${serverUrl}/scopes/add`)}
          />
        {:else}
          <p class="text-sm text-slate-500">Log in to manage EVE characters and API tokens.</p>
        {/if}
      </aside>

    {#if moduleRevision >= 0 && moduleRegistry.isEnabled('wormhole-map')}
      <section data-dock-panel="wormhole-chain" class="hidden h-full rounded-xl border border-slate-700/60 bg-slate-950/50 p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold tracking-[0.2em] text-slate-500">SECONDARY WORKSPACE</p>
            <h2 class="mt-1 text-lg font-medium">Wormhole chain map</h2>
          </div>
          <span class="text-xs text-slate-500">Docked lower by default</span>
          <button class="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300" onclick={() => openPanelWindow('wormhole-chain')}>Pop out</button>
        </div>
        {#if chainSnapshot}
          <WormholeChain
            snapshot={chainSnapshot}
            selectedSystemId={selectedChainSystemId}
            {selectedConnectionId}
            onSelect={selectChainSystem}
            onMove={persistChainSystemPosition}
            onSelectConnection={selectChainConnection}
          />
          {#if selectedConnectionId !== null}
            {@const selectedConnection = chainSnapshot.connections.find((connection) => connection.id === selectedConnectionId)}
            {#if selectedConnection}
              <ConnectionEditor
                connection={selectedConnection}
                onSave={saveSelectedConnection}
                onDelete={deleteSelectedConnection}
                onClose={() => selectedConnectionId = null}
              />
            {/if}
          {/if}
          <ChainEditToolbar
            bind:newChainSystemId
            bind:connectionFromId
            bind:connectionToId
            bind:signaturePaste
            bind:trackedDestinationId
            onAddSystem={addChainSystem}
            onConnect={connectChainSystems}
            onSyncSignatures={syncSignatures}
            onTrackJump={applyTrackedTransition}
            onImportEveScout={importEveScout}
          />
          <SavedLocationsPanel
            savedLocations={chainSnapshot.savedLocations}
            statistics={mapStatistics}
            bind:systemId={savedLocationSystemId}
            bind:note={savedLocationNote}
            onSave={addSavedLocation}
            onRemove={removeSavedLocation}
          />
          {#if selectedChainSystemId !== null}
            {@const selectedSignatureSystem = chainSnapshot.systems.find((system) => system.id === selectedChainSystemId)}
            {#if selectedSignatureSystem}
              <SignatureList
                signatures={selectedSignatureSystem.signatures}
                onDelete={deleteSelectedSignature}
                onDeleteAll={deleteAllSelectedSignatures}
                onEdit={editSelectedSignature}
              />
              <HomeRallyControls
                isHome={selectedSignatureSystem.solarsystemId === chainSnapshot.homeSolarsystemId}
                isRally={selectedSignatureSystem.solarsystemId === chainSnapshot.rallySolarsystemId}
                onSetHome={() => updateHomeSystem(selectedSignatureSystem.id)}
                onClearHome={() => updateHomeSystem(null)}
                onSetRally={() => updateRallyPoint(selectedSignatureSystem.solarsystemId)}
                onClearRally={() => updateRallyPoint(null)}
              />
            {/if}
          {/if}
          {#if selectedSystemDetails?.id === selectedChainSystemId}
            <MapActivityLog audits={selectedSystemDetails.audits} />
          {/if}
          {#if chainError}<p class="mt-3 text-xs text-amber-200">{chainError}</p>{/if}
        {:else}
          <p class="mt-4 text-sm text-slate-500">Log in and select a map to load the chain.</p>
        {/if}
      </section>
    {/if}
    </div>
  </section>
</main>
