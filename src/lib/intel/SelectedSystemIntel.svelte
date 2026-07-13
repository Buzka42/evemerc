<script lang="ts">
  import type { SystemIntel } from './system';

  interface Props {
    systemId: number;
    intel: SystemIntel | null;
    error: string | null;
  }

  let { systemId, intel, error }: Props = $props();
</script>

<div class="border-t border-slate-700/70 pt-4">
  <p class="text-xs font-semibold tracking-[0.15em] text-slate-500">SELECTED SYSTEM · {systemId}</p>
  {#if intel?.systemId === systemId}
    <dl class="mt-2 grid grid-cols-2 gap-2 text-xs">
      <div class="rounded bg-slate-900/70 p-2"><dt class="text-slate-500">Jumps (1h)</dt><dd class="text-lg">{intel.jumps}</dd></div>
      <div class="rounded bg-slate-900/70 p-2"><dt class="text-slate-500">Kills (24h)</dt><dd class="text-lg">{intel.totalKills24h ?? '—'}</dd></div>
      <div class="rounded bg-slate-900/70 p-2"><dt class="text-slate-500">Recent feed</dt><dd class="text-lg">{intel.recentKills}</dd></div>
      <div class="rounded bg-slate-900/70 p-2"><dt class="text-slate-500">Sov structures</dt><dd class="text-lg">{intel.sovereigntyStructures}</dd></div>
    </dl>
  {:else if error}<p class="mt-2 text-xs text-amber-200">{error}</p>
  {:else}<p class="mt-2 text-xs text-slate-500">Loading system intel…</p>{/if}
</div>
