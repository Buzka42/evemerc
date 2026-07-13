<script lang="ts">
  import type { IntelChannelMessage } from '../telemetry/eveLogs';

  interface Props {
    messages: IntelChannelMessage[];
  }

  let { messages }: Props = $props();

  function time(observedAt: string): string {
    const parsed = new Date(observedAt);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="mt-3 border-t border-slate-700/70 pt-3">
  <p class="text-xs font-semibold tracking-[0.14em] text-slate-400">INTEL CHANNELS</p>
  <div class="mt-2 grid max-h-56 gap-1 overflow-y-auto">
    {#each messages as message (message.sourceEventId)}
      <div class="rounded bg-slate-900/70 px-2 py-1.5 text-xs">
        <div class="flex items-center justify-between gap-2 text-slate-500">
          <span class="truncate">{message.channel} · {message.speaker}</span>
          <span>{time(message.observedAt)}</span>
        </div>
        <p class="mt-0.5 text-slate-300">{message.message}</p>
      </div>
    {/each}
    {#if messages.length === 0}
      <p class="text-xs text-slate-500">No intel messages yet. Track a channel in Telemetry settings.</p>
    {/if}
  </div>
</div>
