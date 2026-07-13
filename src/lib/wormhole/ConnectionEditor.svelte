<script lang="ts">
  import { untrack } from 'svelte';
  import type { ChainConnection, ChainConnectionUpdate } from './types';

  interface Props {
    connection: ChainConnection;
    onSave: (update: ChainConnectionUpdate) => void;
    onDelete: () => void;
    onClose: () => void;
  }

  let { connection, onSave, onDelete, onClose }: Props = $props();

  let massStatus = $state<ChainConnectionUpdate['massStatus']>(untrack(() => asMassStatus(connection.massStatus)));
  let lifetimeStatus = $state<ChainConnectionUpdate['lifetimeStatus']>(untrack(() => asLifetimeStatus(connection.lifetimeStatus)));
  let shipSize = $state<ChainConnectionUpdate['shipSize']>(untrack(() => asShipSize(connection.shipSize)));
  let confirmingDelete = $state(false);

  $effect(() => {
    massStatus = asMassStatus(connection.massStatus);
    lifetimeStatus = asLifetimeStatus(connection.lifetimeStatus);
    shipSize = asShipSize(connection.shipSize);
    confirmingDelete = false;
  });

  function asMassStatus(value: string | null): ChainConnectionUpdate['massStatus'] {
    return value === 'fresh' || value === 'reduced' || value === 'critical' || value === 'unknown' ? value : null;
  }

  function asLifetimeStatus(value: string | null): ChainConnectionUpdate['lifetimeStatus'] {
    return value === 'healthy' || value === 'eol' || value === 'critical' ? value : null;
  }

  function asShipSize(value: string | null): ChainConnectionUpdate['shipSize'] {
    return value === 'frigate' || value === 'medium' || value === 'large' ? value : null;
  }

  function submit(): void {
    onSave({ massStatus, lifetimeStatus, shipSize });
  }

  function handleDeleteClick(): void {
    if (confirmingDelete) {
      confirmingDelete = false;
      onDelete();
    } else {
      confirmingDelete = true;
    }
  }
</script>

<div class="rounded-lg border border-cyan-300/20 bg-slate-950/80 p-3 text-xs">
  <div class="flex items-center justify-between">
    <p class="font-semibold tracking-[0.14em] text-slate-400">CONNECTION</p>
    <button class="text-slate-500" onclick={onClose} aria-label="Close connection editor">×</button>
  </div>
  <div class="mt-2 grid grid-cols-3 gap-2">
    <label class="flex flex-col gap-1">
      <span class="text-slate-500">Mass</span>
      <select class="rounded border border-slate-700 bg-slate-900 px-2 py-1" bind:value={massStatus}>
        <option value={null}>Unknown</option>
        <option value="fresh">Fresh</option>
        <option value="reduced">Reduced</option>
        <option value="critical">Critical</option>
        <option value="unknown">Unknown (explicit)</option>
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-slate-500">Lifetime</span>
      <select class="rounded border border-slate-700 bg-slate-900 px-2 py-1" bind:value={lifetimeStatus}>
        <option value={null}>Unknown</option>
        <option value="healthy">Healthy</option>
        <option value="eol">End of life</option>
        <option value="critical">Critical</option>
      </select>
    </label>
    <label class="flex flex-col gap-1">
      <span class="text-slate-500">Ship size</span>
      <select class="rounded border border-slate-700 bg-slate-900 px-2 py-1" bind:value={shipSize}>
        <option value={null}>Unknown</option>
        <option value="frigate">Frigate</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
    </label>
  </div>
  <div class="mt-2 flex gap-2">
    <button class="rounded border border-slate-700 px-2 py-1" onclick={submit}>Save</button>
    <button
      class="rounded border px-2 py-1"
      class:border-rose-400={confirmingDelete}
      class:text-rose-300={confirmingDelete}
      class:border-slate-700={!confirmingDelete}
      onclick={handleDeleteClick}
    >{confirmingDelete ? 'Confirm delete?' : 'Delete connection'}</button>
    {#if confirmingDelete}
      <button class="rounded border border-slate-700 px-2 py-1 text-slate-400" onclick={() => confirmingDelete = false}>Cancel</button>
    {/if}
  </div>
</div>
