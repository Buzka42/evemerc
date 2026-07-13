<script lang="ts">
  import type { ChainSnapshot } from './types';
  import { jumpsBetween } from './rallyRoute';

  interface Props {
    snapshot: ChainSnapshot;
    fromMapSolarsystemId: number | null;
  }

  let { snapshot, fromMapSolarsystemId }: Props = $props();

  const rallySystem = $derived(snapshot.systems.find((system) => system.solarsystemId === snapshot.rallySolarsystemId) ?? null);
  const jumps = $derived(rallySystem && fromMapSolarsystemId !== null ? jumpsBetween(snapshot, fromMapSolarsystemId, rallySystem.id) : null);
</script>

{#if rallySystem}
  <div class="absolute right-3 top-3 z-10 rounded-md border border-pink-400/30 bg-gradient-to-br from-pink-950/90 to-slate-950/90 px-3 py-2 text-xs shadow-lg shadow-pink-500/10 backdrop-blur-md">
    <p class="hud-label text-pink-300">Rally point</p>
    <p class="mt-1 font-medium text-pink-100">
      {rallySystem.alias ?? rallySystem.name ?? rallySystem.solarsystemId}
      {#if rallySystem.wormholeClass}<span class="text-pink-300/70"> · C{rallySystem.wormholeClass}</span>{/if}
    </p>
    {#if jumps !== null}
      <p class="mt-0.5 text-pink-300/80">{jumps} jump{jumps === 1 ? '' : 's'} away</p>
    {/if}
  </div>
{/if}
