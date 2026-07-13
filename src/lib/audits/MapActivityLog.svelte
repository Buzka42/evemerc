<script lang="ts">
  import type { MapAuditEntry } from './api';
  import { describeAudit } from './describe';

  interface Props {
    audits: MapAuditEntry[];
  }

  let { audits }: Props = $props();
</script>

<div class="mt-3 border-t border-slate-700/70 pt-3">
  <p class="hud-label">Map activity</p>
  <div class="mt-2 max-h-40 overflow-y-auto text-xs">
    {#each audits.slice(0, 50) as audit (audit.id)}
      <div class="flex items-center justify-between gap-2 border-b border-slate-800 py-1">
        <span class="min-w-0 truncate" title={audit.createdAt ?? ''}>{describeAudit(audit)}</span>
        <time class="shrink-0 text-slate-600">{audit.createdAt ?? ''}</time>
      </div>
    {/each}
    {#if audits.length === 0}<p class="text-slate-500">No recorded activity for this system.</p>{/if}
  </div>
</div>
