<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    actions?: Snippet;
    children: Snippet;
  }

  let { title, actions, children }: Props = $props();
</script>

<div class="border-t border-border pt-4 first:border-t-0 first:pt-0">
  <div class="flex items-center justify-between gap-2">
    <p class="hud-label">{title}</p>
    {#if actions}{@render actions()}{/if}
  </div>
  <div class="mt-2">
    {@render children()}
  </div>
</div>
