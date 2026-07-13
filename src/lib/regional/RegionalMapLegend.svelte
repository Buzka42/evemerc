<script lang="ts">
  interface Props {
    regionName: string | null;
  }

  let { regionName }: Props = $props();
</script>

<div class="absolute bottom-3 left-3 rounded-md border border-border/50 bg-background/90 p-3 text-xs shadow-lg backdrop-blur-sm">
  <p class="mb-2 hud-label">{regionName ?? 'Region'} legend</p>
  <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
    <div class="flex items-center gap-2"><span class="size-3 rounded-full border border-[#67e8f9] bg-[#0F1923]"></span>Highsec</div>
    <div class="flex items-center gap-2"><span class="size-3 rounded-full border border-[#fbbf24] bg-[#0F1923]"></span>Lowsec</div>
    <div class="flex items-center gap-2"><span class="size-3 rounded-full border border-[#fb7185] bg-[#0F1923]"></span>Nullsec</div>
    <div class="flex items-center gap-2">
      <span class="flex size-3 items-center justify-center rounded-full bg-[#22c55e] text-[8px] font-bold text-[#0F1923]">1</span>
      Fleet presence
    </div>
  </div>
  <div class="mt-2 flex items-center gap-3 border-t border-border/50 pt-2">
    <span class="text-[#fb7185]">⚔ Ships</span>
    <span class="text-[#9CA3AF]">~ NPCs</span>
  </div>
</div>
