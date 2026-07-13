<script lang="ts">
  interface Props {
    newChainSystemId: string;
    connectionFromId: string;
    connectionToId: string;
    signaturePaste: string;
    trackedDestinationId: string;
    onAddSystem: () => void;
    onConnect: () => void;
    onSyncSignatures: () => void;
    onTrackJump: () => void;
    onImportEveScout: (system: 'Thera' | 'Turnur') => void;
  }

  let {
    newChainSystemId = $bindable(),
    connectionFromId = $bindable(),
    connectionToId = $bindable(),
    signaturePaste = $bindable(),
    trackedDestinationId = $bindable(),
    onAddSystem,
    onConnect,
    onSyncSignatures,
    onTrackJump,
    onImportEveScout,
  }: Props = $props();
</script>

<div class="grid gap-3 border-t border-slate-700/70 pt-4 lg:grid-cols-3">
  <div class="flex gap-2">
    <input class="min-w-0 grow rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" placeholder="Solar system ID" bind:value={newChainSystemId} />
    <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onAddSystem}>Add system</button>
  </div>
  <div class="flex gap-2">
    <input class="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" placeholder="From map ID" bind:value={connectionFromId} />
    <input class="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" placeholder="To map ID" bind:value={connectionToId} />
    <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onConnect}>Connect</button>
  </div>
  <div class="flex gap-2">
    <textarea class="min-h-16 min-w-0 grow rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" placeholder="Paste Probe Scanner rows" bind:value={signaturePaste}></textarea>
    <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onSyncSignatures}>Sync sigs</button>
  </div>
</div>
<div class="mt-3 flex flex-wrap gap-2 border-t border-slate-700/70 pt-3">
  <input class="w-36 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" placeholder="Tracked destination ID" bind:value={trackedDestinationId} />
  <button class="rounded border border-slate-700 px-2 py-1 text-xs" onclick={onTrackJump}>Track jump</button>
  <button class="rounded border border-violet-400/30 px-2 py-1 text-xs text-violet-200" onclick={() => onImportEveScout('Thera')}>Import Thera</button>
  <button class="rounded border border-violet-400/30 px-2 py-1 text-xs text-violet-200" onclick={() => onImportEveScout('Turnur')}>Import Turnur</button>
</div>
