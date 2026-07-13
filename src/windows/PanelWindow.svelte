<script lang="ts">
  import { onMount } from 'svelte';
  import RegionMap from '../lib/regional/RegionMap.svelte';
  import WormholeChain from '../lib/wormhole/WormholeChain.svelte';
  import { onPanelState, requestPanelState, type PanelWindowState } from '../lib/layout/panelBridge';
  import type { PanelId } from '../lib/layout/profiles';
  import { setPanelAlwaysOnTop } from '../lib/layout/windows';

  interface Props {
    panelId: PanelId;
    opacity: number;
  }

  let { panelId, opacity }: Props = $props();
  let panelState: PanelWindowState | null = $state(null);
  let panelOpacity = $state(0.94);
  let alwaysOnTop = $state(true);

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

    return () => unlisten();
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
      <h1 class="text-lg font-medium">{panelId === 'wormhole-chain' ? 'Wormhole chain' : panelId === 'fleet-command' ? 'Fleet command' : panelId === 'account' ? 'EVE account' : 'EVE telemetry'}</h1>
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
  {:else}
    <p class="text-sm text-slate-400">This compact panel remains synchronized with the main window. Management controls stay in the main workspace.</p>
  {/if}

  {#if panelState}<p class="mt-3 text-[10px] text-slate-600">Updated {panelState.updatedAt}</p>{/if}
</main>
