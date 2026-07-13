<script lang="ts">
  import { describeObservation, type EveLogObservation, type EveLogStatus } from './eveLogs';

  interface Props {
    logStatus: EveLogStatus | null;
    watcherError: string | null;
    lastObservation: EveLogObservation | null;
    eveLogsRoot: string;
    onApply: () => void;
  }

  let { logStatus, watcherError, lastObservation, eveLogsRoot = $bindable(), onApply }: Props = $props();
</script>

<div class="mt-2 border-t border-slate-700/70 pt-4">
  <div class="flex items-center justify-between">
    <p class="text-xs font-semibold tracking-[0.15em] text-slate-500">EVE LOG TELEMETRY</p>
    <span class:!bg-emerald-300={logStatus?.watching} class="size-2 rounded-full bg-slate-600"></span>
  </div>

  {#if watcherError}
    <p class="mt-2 text-xs leading-5 text-amber-300">{watcherError}</p>
  {:else if logStatus}
    <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
      <dt class="text-slate-500">Gamelogs</dt>
      <dd class="text-right text-slate-300">{logStatus.gamelogFiles}</dd>
      <dt class="text-slate-500">Chatlogs</dt>
      <dd class="text-right text-slate-300">{logStatus.chatlogFiles}</dd>
      <dt class="text-slate-500">Read errors</dt>
      <dd class="text-right text-slate-300">{logStatus.readErrors}</dd>
      <dt class="text-slate-500">New chat lines</dt>
      <dd class="text-right text-slate-300">{logStatus.chatLinesRead}</dd>
    </dl>
  {:else}
    <p class="mt-2 text-xs text-slate-500">Discovering the EVE logs folder…</p>
  {/if}

  {#if lastObservation}
    <div class="mt-3 rounded-md border border-cyan-300/15 bg-cyan-950/20 p-3 text-xs">
      <p class="text-cyan-200">{lastObservation.kind.replace('_', ' ')}</p>
      <p class="mt-1 text-slate-300">{describeObservation(lastObservation)}</p>
    </div>
  {/if}

  <div class="mt-3 flex gap-2">
    <input
      class="min-w-0 grow rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300"
      aria-label="EVE logs root override"
      placeholder="Auto-discover EVE/logs"
      bind:value={eveLogsRoot}
    />
    <button class="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-300" onclick={onApply}>
      Apply
    </button>
  </div>
</div>
