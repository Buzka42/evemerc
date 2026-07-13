<script lang="ts">
  interface Props {
    commanders: Array<Record<string, unknown>>;
    commanderCharacterId: string;
    onAppoint: () => void;
    onRemove: (commanderId: number) => void;
  }

  let { commanders, commanderCharacterId = $bindable(), onAppoint, onRemove }: Props = $props();
</script>

<div class="mt-3 border-t border-slate-700/70 pt-3">
  <div class="flex items-center gap-2">
    <p class="grow text-xs font-semibold tracking-[0.14em] text-slate-400">FLEET COMMANDERS</p>
    <input class="w-32 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs" placeholder="Character ID" bind:value={commanderCharacterId} />
    <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onAppoint}>Appoint</button>
  </div>
  <div class="mt-2 flex flex-wrap gap-2">
    {#each commanders as commander}
      {#if typeof commander.id === 'number'}
        <button class="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300" onclick={() => onRemove(commander.id as number)}>
          {String(commander.character_name ?? commander.character_id ?? commander.id)} ×
        </button>
      {/if}
    {/each}
  </div>
</div>
