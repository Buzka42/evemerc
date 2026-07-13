<script lang="ts">
  import type { ChainSignature } from './types';

  interface Props {
    signatures: ChainSignature[];
    onDelete: (id: number) => void;
    onDeleteAll: () => void;
  }

  let { signatures, onDelete, onDeleteAll }: Props = $props();

  let confirmingDeleteAll = $state(false);

  function handleDeleteAllClick(): void {
    if (confirmingDeleteAll) {
      confirmingDeleteAll = false;
      onDeleteAll();
    } else {
      confirmingDeleteAll = true;
    }
  }
</script>

<div class="mt-3 border-t border-slate-700/70 pt-3">
  <div class="flex items-center justify-between">
    <p class="text-xs font-semibold tracking-[0.14em] text-slate-400">SIGNATURES</p>
    {#if signatures.length > 0}
      <button
        class="rounded border px-2 py-1 text-xs"
        class:border-rose-400={confirmingDeleteAll}
        class:text-rose-300={confirmingDeleteAll}
        class:border-slate-700={!confirmingDeleteAll}
        onclick={handleDeleteAllClick}
      >{confirmingDeleteAll ? 'Confirm clear all?' : 'Clear all'}</button>
    {/if}
  </div>
  <div class="mt-2 flex flex-col gap-1">
    {#each signatures as signature}
      <div class="flex items-center justify-between rounded bg-slate-900/70 px-2 py-1 text-xs">
        <span>{signature.signatureId ?? 'unknown id'} · {signature.rawTypeName ?? 'unresolved'}</span>
        <button class="text-amber-200" onclick={() => onDelete(signature.id)}>Delete</button>
      </div>
    {/each}
    {#if signatures.length === 0}<p class="text-xs text-slate-500">No signatures scanned for this system.</p>{/if}
  </div>
</div>
