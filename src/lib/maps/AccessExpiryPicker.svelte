<script lang="ts">
  interface Props {
    expiresAt: string | null;
    onSetExpiry: (expiresAt: string | null) => void;
  }

  let { expiresAt, onSetExpiry }: Props = $props();

  let open = $state(false);
  let customValue = $state('');

  const presets: { label: string; hours: number }[] = [
    { label: '1 hour', hours: 1 },
    { label: '6 hours', hours: 6 },
    { label: '1 day', hours: 24 },
    { label: '1 week', hours: 24 * 7 },
    { label: '1 month', hours: 24 * 30 },
  ];

  function applyPreset(hours: number): void {
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    onSetExpiry(target.toISOString());
    open = false;
  }

  function applyCustom(): void {
    if (!customValue) return;
    onSetExpiry(new Date(customValue).toISOString());
    open = false;
  }

  function clearExpiry(): void {
    onSetExpiry(null);
    open = false;
  }

  function relativeLabel(iso: string): string {
    const target = new Date(iso).getTime();
    const diffMs = target - Date.now();
    if (diffMs <= 0) return 'Expired';
    const hours = diffMs / (60 * 60 * 1000);
    if (hours < 1) return `${Math.round(hours * 60)}m left`;
    if (hours < 24) return `${Math.round(hours)}h left`;
    return `${Math.round(hours / 24)}d left`;
  }
</script>

<div class="relative">
  <button
    class="rounded border border-slate-700 px-1.5 py-0.5 text-[10px]"
    class:text-rose-300={expiresAt !== null && new Date(expiresAt).getTime() <= Date.now()}
    class:text-slate-400={expiresAt === null}
    onclick={() => (open = !open)}
  >{expiresAt ? relativeLabel(expiresAt) : 'No expiry'}</button>

  {#if open}
    <div class="absolute right-0 top-full z-10 mt-1 w-40 rounded border border-slate-700 bg-slate-950 p-2 shadow-xl">
      <div class="flex flex-col gap-1">
        {#each presets as preset}
          <button class="rounded px-1.5 py-1 text-left text-[10px] hover:bg-slate-800" onclick={() => applyPreset(preset.hours)}>{preset.label}</button>
        {/each}
      </div>
      <div class="mt-2 flex gap-1 border-t border-slate-700 pt-2">
        <input type="datetime-local" class="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px]" bind:value={customValue} />
        <button class="rounded border border-slate-700 px-1.5 text-[10px]" onclick={applyCustom}>Set</button>
      </div>
      {#if expiresAt}
        <button class="mt-2 w-full rounded border border-slate-700 px-1.5 py-1 text-[10px] text-amber-200" onclick={clearExpiry}>Remove expiry</button>
      {/if}
    </div>
  {/if}
</div>
