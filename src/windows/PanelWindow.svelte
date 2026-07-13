<script lang="ts">
  import { onMount } from 'svelte';
  import RegionMap from '../lib/regional/RegionMap.svelte';
  import WormholeChain from '../lib/wormhole/WormholeChain.svelte';
  import SelectedSystemIntel from '../lib/intel/SelectedSystemIntel.svelte';
  import FleetKillfeed from '../lib/intel/FleetKillfeed.svelte';
  import IntelChannelFeed from '../lib/intel/IntelChannelFeed.svelte';
  import { onPanelState, requestPanelState, type PanelWindowState } from '../lib/layout/panelBridge';
  import type { PanelId } from '../lib/layout/profiles';
  import { setPanelAlwaysOnTop } from '../lib/layout/windows';
  import { describeObservation, getEveLogStatus, onEveLogObservation, type EveLogObservation, type EveLogStatus } from '../lib/telemetry/eveLogs';

  interface Props {
    panelId: PanelId;
    opacity: number;
  }

  let { panelId, opacity }: Props = $props();
  let panelState: PanelWindowState | null = $state(null);
  let panelOpacity = $state(0.94);
  let alwaysOnTop = $state(true);
  let logStatus: EveLogStatus | null = $state(null);
  let lastObservation: EveLogObservation | null = $state(null);

  async function toggleAlwaysOnTop(): Promise<void> {
    alwaysOnTop = !alwaysOnTop;
    await setPanelAlwaysOnTop(panelId, alwaysOnTop);
  }

  onMount(() => {
    panelOpacity = opacity;
    let unlisten: () => void = () => {};
    void onPanelState((next) => panelState = next).then((dispose) => {
      unlisten = dispose;
      return requestPanelState();
    });

    let unlistenObservations: () => void = () => {};
    if (panelId === 'telemetry') {
      void getEveLogStatus().then((status) => logStatus = status);
      void onEveLogObservation((observation) => {
        lastObservation = observation;
        if (logStatus) logStatus = { ...logStatus, observationsEmitted: logStatus.observationsEmitted + 1 };
      }).then((dispose) => unlistenObservations = dispose);
    }

    return () => {
      unlisten();
      unlistenObservations();
    };
  });
</script>

<svelte:head><title>EVEMerc panel</title></svelte:head>

<main
  class="min-h-screen p-4 text-slate-100"
  style:background={`rgba(2, 6, 23, ${panelOpacity})`}
>
  <header class="mb-3 flex items-center justify-between border-b border-cyan-300/20 pb-3">
    <div>
      <p class="text-xs tracking-[0.18em] text-cyan-300">EVEMERC LIVE PANEL</p>
      <h1 class="text-lg font-medium">{panelId === 'wormhole-chain' ? 'Wormhole chain' : panelId === 'fleet-command' ? 'Fleet command' : panelId === 'account' ? 'EVE account' : panelId === 'system-intel' ? 'System intel' : 'EVE telemetry'}</h1>
    </div>
    <div class="flex items-center gap-2">
      <label class="flex items-center gap-1 text-[10px] text-slate-500">Opacity <input aria-label="Panel opacity" class="w-16 accent-cyan-300" type="range" min="0.35" max="1" step="0.05" bind:value={panelOpacity} /></label>
      <button class:text-cyan-200={alwaysOnTop} class="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-500" onclick={toggleAlwaysOnTop}>Top</button>
      <span class:text-emerald-300={panelState?.connectionState === 'connected'} class="text-xs text-slate-500">{panelState?.connectionState ?? 'waiting'}</span>
    </div>
  </header>

  {#if !panelState}
    <p class="text-sm text-slate-500">Waiting for the main EVEMerc window…</p>
  {:else if panelId === 'fleet-command'}
    {#if panelState.regionTopology && panelState.fleetSnapshot}
      <RegionMap
        topology={panelState.regionTopology}
        members={panelState.fleetSnapshot.members}
        highlightedSystemId={panelState.objectiveSystemId}
        layers={panelState.regionalLayers}
      />
      <p class="mt-3 text-xs text-slate-400">{panelState.fleetSnapshot.members.length} pilots · revision {panelState.fleetSnapshot.revision}</p>
    {:else}<p class="text-sm text-slate-500">No fleet workspace is currently active.</p>{/if}
  {:else if panelId === 'wormhole-chain'}
    {#if panelState.chainSnapshot}
      <WormholeChain snapshot={panelState.chainSnapshot} selectedSystemId={panelState.selectedChainSystemId} onSelect={() => undefined} />
    {:else}<p class="text-sm text-slate-500">No wormhole chain is currently active.</p>{/if}
  {:else if panelId === 'account'}
    {#if panelState.accountCharacters.length > 0}
      <div class="flex flex-col gap-2">
        {#each panelState.accountCharacters as character}
          <div class="rounded-md bg-slate-900/70 p-3 text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="text-slate-200">{character.name}</span>
              {#if character.isPreferred}<span class="text-emerald-300">preferred</span>{/if}
            </div>
            <p class="mt-1 text-slate-400">{character.isOnline ? 'online' : 'offline'} · {character.solarSystemName ?? 'location unknown'} · {character.shipName ?? 'ship unknown'}</p>
          </div>
        {/each}
      </div>
      <p class="mt-3 text-[10px] text-slate-600">Read-only — manage characters and tokens from the main window.</p>
    {:else}<p class="text-sm text-slate-500">No characters loaded yet.</p>{/if}
  {:else if panelId === 'telemetry'}
    {#if logStatus}
      <dl class="grid grid-cols-2 gap-2 text-xs">
        <dt class="text-slate-500">Gamelogs</dt>
        <dd class="text-right text-slate-300">{logStatus.gamelogFiles}</dd>
        <dt class="text-slate-500">Chatlogs</dt>
        <dd class="text-right text-slate-300">{logStatus.chatlogFiles}</dd>
        <dt class="text-slate-500">Read errors</dt>
        <dd class="text-right text-slate-300">{logStatus.readErrors}</dd>
        <dt class="text-slate-500">Observations</dt>
        <dd class="text-right text-slate-300">{logStatus.observationsEmitted}</dd>
      </dl>
    {:else}<p class="text-sm text-slate-500">Discovering the EVE logs folder…</p>{/if}
    {#if lastObservation}
      <div class="mt-3 rounded-md border border-cyan-300/15 bg-cyan-950/20 p-3 text-xs">
        <p class="text-cyan-200">{lastObservation.kind.replace('_', ' ')}</p>
        <p class="mt-1 text-slate-300">{describeObservation(lastObservation)}</p>
      </div>
    {/if}
    <p class="mt-3 text-[10px] text-slate-600">Read-only — change the EVE logs folder from the main window.</p>
  {:else if panelId === 'system-intel'}
    {#if panelState.selectedRegionalSystemId}
      <SelectedSystemIntel systemId={panelState.selectedRegionalSystemId} intel={panelState.selectedSystemIntel} error={null} />
    {:else}<p class="text-sm text-slate-500">No system is currently selected on the regional map.</p>{/if}
    <FleetKillfeed kills={panelState.fleetKills} error={null} />
    <IntelChannelFeed messages={panelState.intelMessages} />
  {:else}
    <p class="text-sm text-slate-400">This compact panel remains synchronized with the main window. Management controls stay in the main workspace.</p>
  {/if}

  {#if panelState}<p class="mt-3 text-[10px] text-slate-600">Updated {panelState.updatedAt}</p>{/if}
</main>
