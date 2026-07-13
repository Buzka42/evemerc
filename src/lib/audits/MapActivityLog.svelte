<script lang="ts">
  import type { MapAuditEntry } from './api';

  interface Props {
    audits: MapAuditEntry[];
  }

  let { audits }: Props = $props();
</script>

<div class="mt-3 border-t border-slate-700/70 pt-3">
  <p class="text-xs font-semibold tracking-[0.14em] text-slate-400">MAP ACTIVITY</p>
  <div class="mt-2 max-h-40 overflow-y-auto text-xs">
    {#each audits.slice(0, 50) as audit}
      <div class="grid grid-cols-[8rem_1fr_auto] gap-2 border-b border-slate-800 py-1">
        <span class="text-slate-500">{audit.characterName ?? 'system'}</span>
        <span>{audit.event} · {Object.keys(audit.newValues).join(', ') || 'record'}</span>
        <time class="text-slate-600">{audit.createdAt ?? ''}</time>
      </div>
    {/each}
    {#if audits.length === 0}<p class="text-slate-500">No recorded activity for this system.</p>{/if}
  </div>
</div>
