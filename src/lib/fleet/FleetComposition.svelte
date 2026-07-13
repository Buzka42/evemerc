<script lang="ts">
  import type { CompositionEntry } from './composition';

  interface Props {
    entries: CompositionEntry[];
  }

  let { entries }: Props = $props();
</script>

<div class="mt-3 border-t border-slate-700/70 pt-3">
  <p class="hud-label">Fleet composition</p>
  <div class="mt-2 flex flex-col gap-1">
    {#each entries as entry (entry.shipTypeName)}
      <div class="flex items-center justify-between rounded bg-slate-900/70 px-2 py-1 text-xs">
        <span class="min-w-0 truncate">{entry.shipTypeName}</span>
        <span class="flex items-center gap-2">
          <span class="text-slate-300">{entry.count}</span>
          {#if entry.delta > 0}
            <span class="text-emerald-300">+{entry.delta}</span>
          {:else if entry.delta < 0}
            <span class="text-rose-400">{entry.delta}</span>
          {/if}
        </span>
      </div>
    {/each}
    {#if entries.length === 0}<p class="text-xs text-slate-500">No fleet members yet.</p>{/if}
  </div>
</div>
