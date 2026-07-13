<script lang="ts">
  interface MenuItem {
    label: string;
    action: () => void;
    destructive?: boolean;
  }

  interface Props {
    x: number;
    y: number;
    items: MenuItem[];
    onClose: () => void;
  }

  let { x, y, items, onClose }: Props = $props();
</script>

<svelte:window onclick={onClose} onkeydown={(event) => event.key === 'Escape' && onClose()} />

<div
  class="fixed z-50 min-w-40 rounded border border-slate-700 bg-slate-950 py-1 text-xs shadow-2xl"
  style={`left: ${x}px; top: ${y}px;`}
  role="menu"
>
  {#each items as item}
    <button
      class="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
      class:text-rose-300={item.destructive}
      role="menuitem"
      onclick={(event) => { event.stopPropagation(); item.action(); onClose(); }}
    >{item.label}</button>
  {/each}
</div>
