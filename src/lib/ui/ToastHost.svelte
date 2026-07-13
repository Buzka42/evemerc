<script lang="ts">
  import { dismissToast, toastList } from './toast.svelte';

  const toneClasses: Record<string, string> = {
    info: 'border-cyan-300/30 bg-cyan-950/80 text-cyan-100',
    success: 'border-emerald-300/30 bg-emerald-950/80 text-emerald-100',
    warning: 'border-amber-300/30 bg-amber-950/80 text-amber-100',
    error: 'border-rose-300/30 bg-rose-950/80 text-rose-100',
  };
</script>

<div class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
  {#each toastList() as toast (toast.id)}
    <div
      class={`pointer-events-auto flex items-center gap-3 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur-sm ${toneClasses[toast.tone]}`}
      role="status"
    >
      <span>{toast.message}</span>
      <button class="text-current opacity-60 hover:opacity-100" onclick={() => dismissToast(toast.id)} aria-label="Dismiss">✕</button>
    </div>
  {/each}
</div>
