<script lang="ts">
  import type { FleetAlert } from './alerts';

  interface Props {
    alerts: FleetAlert[];
    onFocusSystem: (solarSystemId: number | null) => void;
  }

  let { alerts, onFocusSystem }: Props = $props();
</script>

{#if alerts.length > 0}
  <div class="mt-3 flex flex-col gap-2 border-t border-slate-700/70 pt-3">
    <p class="text-xs font-semibold tracking-[0.14em] text-amber-300">FLEET ALERTS · {alerts.length}</p>
    {#each alerts.slice(0, 6) as alert}
      <button
        class="flex items-center justify-between rounded-md bg-amber-300/10 px-3 py-2 text-left text-xs text-amber-100"
        onclick={() => onFocusSystem(alert.solarSystemId)}
      >
        <span>{alert.title}</span>
        <span>{alert.solarSystemId ?? 'no position'}</span>
      </button>
    {/each}
  </div>
{/if}
