<script lang="ts">
  interface Props {
    ignoredSystemIds: number[];
    input: string;
    onAdd: () => void;
    onRemove: (systemId: number) => void;
  }

  let { ignoredSystemIds, input = $bindable(), onAdd, onRemove }: Props = $props();
</script>

<div class="border-t border-slate-700/70 pt-4">
  <p class="hud-label">ROUTE EXCLUSIONS</p>
  <div class="mt-2 flex gap-2">
    <input
      class="min-w-0 grow rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
      placeholder="Solar system ID"
      bind:value={input}
    />
    <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onAdd}>Ignore</button>
  </div>
  <div class="mt-2 flex flex-wrap gap-2">
    {#each ignoredSystemIds as systemId}
      <button class="rounded-full bg-slate-800 px-3 py-1 text-xs" onclick={() => onRemove(systemId)}>
        {systemId} ×
      </button>
    {/each}
    {#if ignoredSystemIds.length === 0}<p class="text-xs text-slate-500">No systems excluded from routing.</p>{/if}
  </div>
</div>
