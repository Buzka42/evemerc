<script lang="ts">
  import type { ChainSignature, SignatureUpdate } from './types';

  interface Props {
    signatures: ChainSignature[];
    newSignatureIds?: Set<number>;
    onDelete: (id: number) => void;
    onDeleteAll: () => void;
    onEdit: (id: number, update: SignatureUpdate) => void;
  }

  let { signatures, newSignatureIds = new Set(), onDelete, onDeleteAll, onEdit }: Props = $props();

  let confirmingDeleteAll = $state(false);
  let editingId = $state<number | null>(null);
  let editSignatureId = $state('');
  let editRawTypeName = $state('');

  function handleDeleteAllClick(): void {
    if (confirmingDeleteAll) {
      confirmingDeleteAll = false;
      onDeleteAll();
    } else {
      confirmingDeleteAll = true;
    }
  }

  function startEdit(signature: ChainSignature): void {
    editingId = signature.id;
    editSignatureId = signature.signatureId ?? '';
    editRawTypeName = signature.rawTypeName ?? '';
  }

  function saveEdit(id: number): void {
    onEdit(id, {
      signatureId: editSignatureId || null,
      signatureTypeId: null,
      signatureCategoryId: null,
      rawTypeName: editRawTypeName || null,
    });
    editingId = null;
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
      {#if editingId === signature.id}
        <div class="flex items-center gap-1 rounded bg-slate-900/70 px-2 py-1 text-xs">
          <input
            class="w-16 rounded border border-slate-700 bg-slate-950 px-1 py-0.5"
            placeholder="ABC-123"
            bind:value={editSignatureId}
          />
          <input
            class="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-1 py-0.5"
            placeholder="type name"
            bind:value={editRawTypeName}
          />
          <button class="text-emerald-300" onclick={() => saveEdit(signature.id)}>Save</button>
          <button class="text-slate-400" onclick={() => (editingId = null)}>Cancel</button>
        </div>
      {:else}
        <div
          class={`flex items-center justify-between rounded px-2 py-1 text-xs transition-colors duration-1000 ${newSignatureIds.has(signature.id) ? 'bg-emerald-900' : 'bg-slate-900/70'}`}
        >
          <span>{signature.signatureId ?? 'unknown id'} · {signature.rawTypeName ?? 'unresolved'}</span>
          <span class="flex gap-2">
            <button class="text-cyan-300" onclick={() => startEdit(signature)}>Edit</button>
            <button class="text-amber-200" onclick={() => onDelete(signature.id)}>Delete</button>
          </span>
        </div>
      {/if}
    {/each}
    {#if signatures.length === 0}<p class="text-xs text-slate-500">No signatures scanned for this system.</p>{/if}
  </div>
</div>
