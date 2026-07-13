<script lang="ts">
  import type { MapStatistics } from './api';
  import type { ChainSnapshot } from './types';

  interface Props {
    savedLocations: ChainSnapshot['savedLocations'];
    statistics: MapStatistics | null;
    systemId: string;
    note: string;
    onSave: () => void;
    onRemove: (locationId: number) => void;
  }

  let { savedLocations, statistics, systemId = $bindable(), note = $bindable(), onSave, onRemove }: Props = $props();
</script>

<div class="mt-3 grid gap-3 border-t border-slate-700/70 pt-3 lg:grid-cols-2">
  <div>
    <p class="text-xs font-semibold tracking-[0.14em] text-slate-400">SAVED LOCATIONS</p>
    <div class="mt-2 flex gap-2">
      <input class="w-32 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" placeholder="System ID" bind:value={systemId} />
      <input class="min-w-0 grow rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" placeholder="Note" bind:value={note} />
      <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onSave}>Save</button>
    </div>
    <div class="mt-2 flex flex-wrap gap-2">
      {#each savedLocations as location}
        <button class="rounded-full bg-slate-800 px-3 py-1 text-xs" onclick={() => onRemove(location.id)}>
          {location.note ?? location.solarsystemId} ×
        </button>
      {/each}
    </div>
  </div>
  {#if statistics}
    <dl class="grid grid-cols-5 gap-2 text-center text-xs">
      <div><dt class="text-slate-500">Systems</dt><dd class="mt-1 text-lg">{statistics.systems}</dd></div>
      <div><dt class="text-slate-500">Links</dt><dd class="mt-1 text-lg">{statistics.connections}</dd></div>
      <div><dt class="text-slate-500">Sigs</dt><dd class="mt-1 text-lg">{statistics.signatures}</dd></div>
      <div><dt class="text-slate-500">Saved</dt><dd class="mt-1 text-lg">{statistics.savedLocations}</dd></div>
      <div><dt class="text-slate-500">Fleet</dt><dd class="mt-1 text-lg">{statistics.fleetMembers}</dd></div>
    </dl>
  {/if}
</div>
