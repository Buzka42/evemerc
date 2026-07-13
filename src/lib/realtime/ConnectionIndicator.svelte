<script lang="ts">
  import { Wifi, WifiOff } from '@lucide/svelte';
  import type { ConnectionState } from './echo';

  interface Props {
    state: ConnectionState;
  }

  let { state }: Props = $props();

  const labels: Record<ConnectionState, string> = {
    connected: 'Live',
    reconnecting: 'Reconnecting…',
    offline: 'Offline',
  };
</script>

<span
  class="flex items-center gap-1"
  class:text-emerald-300={state === 'connected'}
  class:text-amber-300={state === 'reconnecting'}
  class:text-rose-400={state === 'offline'}
  title={labels[state]}
>
  {#if state === 'offline'}
    <WifiOff size={12} />
  {:else}
    <Wifi size={12} class={state === 'reconnecting' ? 'animate-pulse' : ''} />
  {/if}
  <span class="size-1.5 rounded-full" class:bg-emerald-300={state === 'connected'} class:animate-pulse={state === 'reconnecting'} class:bg-amber-300={state === 'reconnecting'} class:bg-rose-400={state === 'offline'}></span>
  {labels[state]}
</span>
