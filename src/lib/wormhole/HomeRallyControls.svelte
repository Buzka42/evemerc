<script lang="ts">
  interface Props {
    isHome: boolean;
    isRally: boolean;
    onSetHome: () => void;
    onClearHome: () => void;
    onSetRally: () => void;
    onClearRally: () => void;
  }

  let { isHome, isRally, onSetHome, onClearHome, onSetRally, onClearRally }: Props = $props();
</script>

<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-700/70 pt-3 text-xs">
  <p class="mr-1 font-semibold tracking-[0.14em] text-slate-400">THIS SYSTEM</p>
  {#if isHome}
    <span class="rounded-full bg-cyan-300/10 px-2 py-1 text-cyan-200">Home system</span>
    <button class="rounded border border-slate-700 px-2 py-1 text-slate-300" onclick={onClearHome}>Clear home</button>
  {:else}
    <button class="rounded border border-slate-700 px-2 py-1 text-slate-300" onclick={onSetHome}>Set as home</button>
  {/if}
  {#if isRally}
    <span class="rounded-full bg-amber-300/10 px-2 py-1 text-amber-200">Rally point</span>
    <button class="rounded border border-slate-700 px-2 py-1 text-slate-300" onclick={onClearRally}>Clear rally</button>
  {:else}
    <button class="rounded border border-slate-700 px-2 py-1 text-slate-300" onclick={onSetRally}>Set as rally</button>
  {/if}
</div>
