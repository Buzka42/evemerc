<script lang="ts">
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { zkillUrl, type FleetKill } from './killfeed';

  interface Props {
    kills: FleetKill[];
    error: string | null;
  }

  let { kills, error }: Props = $props();
</script>

<div class="mt-3 border-t border-slate-700/70 pt-3">
  <div class="flex items-center justify-between">
    <p class="text-xs font-semibold tracking-[0.14em] text-slate-400">FLEET KILLFEED</p>
    <span class="text-[10px] text-slate-600">zKillboard · 2 min cache</span>
  </div>
  <div class="mt-2 grid max-h-40 gap-1 overflow-y-auto">
    {#each kills as kill}
      <button
        class="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 rounded bg-slate-900/70 px-2 py-1.5 text-left text-xs hover:bg-slate-800"
        onclick={() => openUrl(zkillUrl(kill.id))}
      >
        <span class:text-rose-300={kill.involvement === 'loss'} class="font-semibold text-emerald-300">{kill.involvement.toUpperCase()}</span>
        <span class="min-w-0 truncate"><strong>{kill.victimShip}</strong> · {kill.victimName}</span>
        <span class="text-slate-500">{kill.value === null ? `${kill.attackerCount} atk` : `${(kill.value / 1_000_000).toFixed(1)}m`}</span>
      </button>
    {/each}
    {#if kills.length === 0}<p class="text-xs text-slate-500">No recent roster kills or losses.</p>{/if}
    {#if error}<p class="text-xs text-amber-200">{error}</p>{/if}
  </div>
</div>
